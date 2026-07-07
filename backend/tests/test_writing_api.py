"""Tests for the writing endpoints (content, draft, recap, rewrite, chat).

LLM calls are patched so the endpoints can be verified without a live model.
"""

import json

import app.routers.outline as outline_router
import app.routers.writing as writing_router
from app.models import Chapter


def _patch_llm(monkeypatch, router, value) -> None:
    """Patch a router's chat_completion to return canned text/JSON."""

    async def fake_completion(connection, messages, params=None, **kwargs):
        return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)

    monkeypatch.setattr(router, "chat_completion", fake_completion)


async def _setup_work_with_chapters(client, monkeypatch) -> tuple[dict, dict]:
    """Create a work and generate a 3-stage / 3-chapter skeleton outline."""
    await client.put(
        "/api/settings/connection",
        json={"url": "https://stub/chat", "api_token": "t", "model": "m"},
    )
    structures = (await client.get("/api/structures")).json()
    structure_id = next(s["id"] for s in structures if s["name"] == "三幕式")
    work = (
        await client.post(
            "/api/works",
            json={"title": "测试作品", "structure_id": structure_id, "planned_chapter_count": 3},
        )
    ).json()
    _patch_llm(
        monkeypatch,
        outline_router,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 1, "overview": "c"},
        ],
    )
    outline = (await client.post(f"/api/works/{work['id']}/outline/stages:generate")).json()
    return work, outline


async def test_save_content_recomputes_word_counts(client, monkeypatch):
    """Saving content recomputes the chapter and the work total word counts."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]

    saved = (
        await client.put(f"/api/chapters/{chapter_id}/content", json={"content": "你好世界"})
    ).json()
    assert saved["word_count"] == 4

    total = (await client.get(f"/api/works/{work['id']}/word-count")).json()
    assert total["total_word_count"] == 4

    fetched = (await client.get(f"/api/chapters/{chapter_id}")).json()
    assert fetched["content"] == "你好世界"


async def test_generate_draft_fills_content(client, monkeypatch):
    """Draft generation stores the model's text and recounts the words."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, writing_router, "这是生成的正文。")

    drafted = (
        await client.post(f"/api/chapters/{chapter_id}/draft:generate", json={})
    ).json()
    assert drafted["content"] == "这是生成的正文。"
    assert drafted["word_count"] == 7


async def test_generate_draft_with_recap_auto_summarizes_and_caches(client, monkeypatch):
    """include_recap without a cached recap summarizes the previous chapter once,
    injects it into the draft prompt, and caches it for later reuse."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    first, second = outline["chapters"][0], outline["chapters"][1]
    await client.put(f"/api/chapters/{first['id']}/content", json={"content": "第一章内容"})

    calls: list = []

    async def capturing(connection, messages, params=None, **kwargs):
        """Record every LLM call's messages and return a canned recap/draft text."""
        calls.append(messages)
        return "第一章前情提要"

    monkeypatch.setattr(writing_router, "chat_completion", capturing)

    drafted = (
        await client.post(
            f"/api/chapters/{second['id']}/draft:generate", json={"include_recap": True}
        )
    ).json()
    assert drafted["content"] == "第一章前情提要"

    # Two calls: first summarizes the previous chapter, second drafts the body.
    assert len(calls) == 2
    draft_prompt = calls[1][-1]["content"]
    assert "【前情提要】" in draft_prompt
    assert "第一章前情提要" in draft_prompt

    # The freshly generated recap is now cached on the previous chapter.
    cached = (await client.get(f"/api/chapters/{second['id']}/recap")).json()
    assert cached["cached"] is True
    assert cached["recap"] == "第一章前情提要"


async def test_generate_draft_with_recap_skips_when_previous_has_no_content(client, monkeypatch):
    """include_recap does not summarize (or inject) when the previous chapter is empty."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    second = outline["chapters"][1]

    calls: list = []

    async def capturing(connection, messages, params=None, **kwargs):
        """Record every LLM call's messages and return canned draft text."""
        calls.append(messages)
        return "这是生成的正文。"

    monkeypatch.setattr(writing_router, "chat_completion", capturing)

    await client.post(
        f"/api/chapters/{second['id']}/draft:generate", json={"include_recap": True}
    )

    # Only the draft call happens; no recap summary and no 前情提要 in the prompt.
    assert len(calls) == 1
    assert "【前情提要】" not in calls[0][-1]["content"]


async def test_recap_cache_and_staleness(client, monkeypatch, session):
    """Recap is cached for the previous chapter and marked stale after edits."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    first, second = outline["chapters"][0], outline["chapters"][1]
    await client.put(f"/api/chapters/{first['id']}/content", json={"content": "第一章内容"})

    pending = (await client.get(f"/api/chapters/{second['id']}/recap")).json()
    assert pending["has_previous"] is True
    assert pending["cached"] is False
    assert pending["previous_chapter_number"] == 1

    _patch_llm(monkeypatch, writing_router, "第一章的前情提要")
    generated = (await client.post(f"/api/chapters/{second['id']}/recap:generate")).json()
    assert generated["recap"] == "第一章的前情提要"
    assert generated["stale"] is False

    cached = (await client.get(f"/api/chapters/{second['id']}/recap")).json()
    assert cached["cached"] is True
    assert cached["stale"] is False

    # Simulate a later modification of the previous chapter.
    chapter = await session.get(Chapter, first["id"])
    chapter.updated_at = "2099-01-01 00:00:00"
    await session.commit()

    stale = (await client.get(f"/api/chapters/{second['id']}/recap")).json()
    assert stale["stale"] is True


async def test_recap_first_chapter_has_no_previous(client, monkeypatch):
    """The first chapter has no previous chapter to summarize."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    first = outline["chapters"][0]
    recap = (await client.get(f"/api/chapters/{first['id']}/recap")).json()
    assert recap["has_previous"] is False


async def test_recap_generate_requires_previous_content(client, monkeypatch):
    """Generating a recap fails when the previous chapter has no body text."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    second = outline["chapters"][1]
    response = await client.post(f"/api/chapters/{second['id']}/recap:generate")
    assert response.status_code == 400


async def test_rewrite_returns_original_and_rewritten(client, monkeypatch):
    """A rewrite returns the original and the new passage without persisting."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, writing_router, "重写后的文字")

    result = (
        await client.post(
            f"/api/chapters/{chapter_id}/rewrite",
            json={"selection": "原始文字", "instruction": "更生动"},
        )
    ).json()
    assert result == {"original": "原始文字", "rewritten": "重写后的文字"}


async def test_rewrite_with_neighbors_injects_cohesion_context(client, monkeypatch):
    """强化衔接 adds 上文/下文 blocks and a cohesion instruction to the prompt."""
    _work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]

    captured: dict = {}

    async def capturing(connection, messages, params=None, **kwargs):
        captured["messages"] = messages
        return "重写后的文字"

    monkeypatch.setattr(writing_router, "chat_completion", capturing)

    await client.post(
        f"/api/chapters/{chapter_id}/rewrite",
        json={
            "selection": "原始文字",
            "preceding": "前一段落。",
            "following": "后一段落。",
        },
    )
    prompt = captured["messages"][-1]["content"]
    assert "【上文" in prompt
    assert "前一段落。" in prompt
    assert "【下文" in prompt
    assert "后一段落。" in prompt
    assert "衔接" in prompt


async def test_chat_returns_reply(client, monkeypatch):
    """The writing-assistant chat returns the model's reply."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, writing_router, "我建议这样开头……")

    reply = (
        await client.post(
            f"/api/works/{work['id']}/chat",
            json={"content": "怎么开头", "chapter_id": chapter_id},
        )
    ).json()
    assert reply["reply"] == "我建议这样开头……"


async def test_chat_injects_referenced_entities(client, monkeypatch):
    """`@`-referenced entries are injected into the chat context message."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    categories = (await client.get(f"/api/works/{work['id']}/categories")).json()
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={
            "category_id": categories[0]["id"],
            "name": "莉娜",
            "description": "果敢的女骑士",
        },
    )

    captured: dict = {}

    async def capturing(connection, messages, params=None, **kwargs):
        captured["messages"] = messages
        return "好的"

    monkeypatch.setattr(writing_router, "chat_completion", capturing)

    await client.post(
        f"/api/works/{work['id']}/chat",
        json={"content": "描写一下 @莉娜 的出场", "chapter_id": chapter_id},
    )
    context = captured["messages"][1]["content"]
    assert "【引用设定】" in context
    assert "果敢的女骑士" in context
