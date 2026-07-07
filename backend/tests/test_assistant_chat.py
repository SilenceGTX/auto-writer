"""Tests for persisted assistant chat history."""

import json

import app.routers.outline as outline_router
import app.routers.review as review_router
import app.routers.writing as writing_router
from app.services.assistant_conversation_service import MAX_ASSISTANT_MESSAGES


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


async def test_writing_chat_persists_and_reloads(client, monkeypatch):
    """Writing chat exchanges are stored and returned by the history endpoint."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, writing_router, "我建议这样开头……")

    sent = (
        await client.post(
            f"/api/works/{work['id']}/chat",
            json={"content": "怎么开头", "chapter_id": chapter_id},
        )
    ).json()
    assert sent["reply"] == "我建议这样开头……"
    assert len(sent["messages"]) == 2

    loaded = (
        await client.get(
            f"/api/works/{work['id']}/chat/messages",
            params={"chapter_id": chapter_id},
        )
    ).json()
    assert len(loaded["messages"]) == 2
    assert loaded["messages"][0]["content"] == "怎么开头"
    assert loaded["messages"][1]["content"] == "我建议这样开头……"


async def test_writing_chat_clear_memory(client, monkeypatch):
    """Clearing writing chat history removes persisted messages."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, writing_router, "回复")

    await client.post(
        f"/api/works/{work['id']}/chat",
        json={"content": "问题", "chapter_id": chapter_id},
    )
    response = await client.delete(
        f"/api/works/{work['id']}/chat/messages",
        params={"chapter_id": chapter_id},
    )
    assert response.status_code == 204

    loaded = (
        await client.get(
            f"/api/works/{work['id']}/chat/messages",
            params={"chapter_id": chapter_id},
        )
    ).json()
    assert loaded["messages"] == []


async def test_writing_chat_trims_history_to_cap(client, monkeypatch):
    """Only the most recent ``MAX_ASSISTANT_MESSAGES`` rows are kept."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, writing_router, "回复")

    turns = (MAX_ASSISTANT_MESSAGES // 2) + 2
    for index in range(turns):
        await client.post(
            f"/api/works/{work['id']}/chat",
            json={"content": f"问题{index}", "chapter_id": chapter_id},
        )

    loaded = (
        await client.get(
            f"/api/works/{work['id']}/chat/messages",
            params={"chapter_id": chapter_id},
        )
    ).json()
    assert len(loaded["messages"]) == MAX_ASSISTANT_MESSAGES
    removed = turns * 2 - MAX_ASSISTANT_MESSAGES
    first_turn = removed // 2
    assert loaded["messages"][0]["content"] == f"问题{first_turn}"
    assert loaded["messages"][-2]["content"] == f"问题{turns - 1}"


async def test_review_chat_persists_and_clears(client, monkeypatch):
    """Review chat history is scoped per chapter and can be cleared."""
    work, outline = await _setup_work_with_chapters(client, monkeypatch)
    chapter_id = outline["chapters"][0]["id"]
    _patch_llm(monkeypatch, review_router, "这里需要调整。")

    sent = (
        await client.post(
            f"/api/works/{work['id']}/review/chat",
            json={"content": "帮我检查", "chapter_id": chapter_id, "quoted": "片段"},
        )
    ).json()
    assert sent["reply"] == "这里需要调整。"
    assert sent["messages"][0]["quoted"] == "片段"

    await client.delete(
        f"/api/works/{work['id']}/review/chat/messages",
        params={"chapter_id": chapter_id},
    )
    loaded = (
        await client.get(
            f"/api/works/{work['id']}/review/chat/messages",
            params={"chapter_id": chapter_id},
        )
    ).json()
    assert loaded["messages"] == []
