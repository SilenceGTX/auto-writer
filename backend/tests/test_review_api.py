"""Tests for the review endpoints (AI review chat over a work's chapters).

LLM calls are patched so the endpoint can be verified without a live model.
"""

import json

import app.routers.outline as outline_router
import app.routers.review as review_router


def _patch_llm(monkeypatch, router, value) -> None:
    """Patch a router's chat_completion to return canned text/JSON."""

    async def fake_completion(connection, messages, params=None):
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


async def test_review_chat_returns_reply(client, monkeypatch):
    """The review chat returns the model's reply for the quoted passage."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, review_router, "这里的时间线有冲突，建议调整。")

    reply = (
        await client.post(
            f"/api/works/{work['id']}/review/chat",
            json={
                "messages": [{"role": "user", "content": "帮我检查这一段"}],
                "chapter_id": chapter_id,
                "quoted": "他在午夜抵达，却看见正午的阳光。",
            },
        )
    ).json()
    assert reply["reply"] == "这里的时间线有冲突，建议调整。"


async def test_review_chat_uses_editor_instruction(client, monkeypatch):
    """The review chat injects editor framing and attaches quotes to the user turn."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]

    captured: dict = {}

    async def capturing(connection, messages, params=None):
        captured["messages"] = messages
        return "好的"

    monkeypatch.setattr(review_router, "chat_completion", capturing)

    await client.post(
        f"/api/works/{work['id']}/review/chat",
        json={
            "messages": [{"role": "user", "content": "检查连贯性"}],
            "chapter_id": chapter_id,
            "quoted": "片段",
        },
    )
    system_messages = [m["content"] for m in captured["messages"] if m["role"] == "system"]
    user_messages = [m["content"] for m in captured["messages"] if m["role"] == "user"]
    assert any("小说编辑" in content for content in system_messages)
    assert any("【作品简介】" in content for content in system_messages)
    assert any("【当前章节正文】" in content for content in system_messages)
    assert not any("【用户引用的片段】" in content for content in system_messages)
    assert user_messages[-1].startswith("【用户引用的片段】")
    assert "片段" in user_messages[-1]
    assert "检查连贯性" in user_messages[-1]


async def test_review_chat_injects_referenced_entities(client, monkeypatch):
    """`@`-referenced entries are injected into the review context message."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    categories = (await client.get(f"/api/works/{work['id']}/categories")).json()
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={"category_id": categories[0]["id"], "name": "莉娜", "description": "果敢的女骑士"},
    )

    captured: dict = {}

    async def capturing(connection, messages, params=None):
        captured["messages"] = messages
        return "好的"

    monkeypatch.setattr(review_router, "chat_completion", capturing)

    await client.post(
        f"/api/works/{work['id']}/review/chat",
        json={
            "messages": [{"role": "user", "content": "@莉娜 的描写是否一致"}],
            "chapter_id": chapter_id,
        },
    )
    context = "\n".join(m["content"] for m in captured["messages"] if m["role"] == "system")
    assert "【引用设定】" in context
    assert "果敢的女骑士" in context


async def test_review_chat_resolves_at_in_summary_and_body(client, monkeypatch):
    """`@` markers in work summary and chapter body are resolved like the outline flow."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    await client.patch(
        f"/api/works/{work['id']}",
        json={"summary": "故事围绕 @魔法石 展开"},
    )
    await client.put(
        f"/api/chapters/{chapter_id}/content",
        json={"content": "主角握住了 @魔法石 。"},
    )
    categories = (await client.get(f"/api/works/{work['id']}/categories")).json()
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={
            "category_id": categories[0]["id"],
            "name": "魔法石",
            "description": "蕴含远古力量的宝石",
        },
    )

    captured: dict = {}

    async def capturing(connection, messages, params=None):
        captured["messages"] = messages
        return "好的"

    monkeypatch.setattr(review_router, "chat_completion", capturing)

    await client.post(
        f"/api/works/{work['id']}/review/chat",
        json={
            "messages": [{"role": "user", "content": "检查设定一致性"}],
            "chapter_id": chapter_id,
        },
    )
    context = "\n".join(m["content"] for m in captured["messages"] if m["role"] == "system")
    assert "【引用设定】" in context
    assert "蕴含远古力量的宝石" in context
    assert "【当前章节正文】" in context
    assert "主角握住了 @魔法石 。" in context
