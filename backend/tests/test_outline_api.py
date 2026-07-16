"""Tests for the outline endpoints (stages, chapters, generation, reorder).

LLM generation is exercised by patching ``chat_completion`` so the endpoints can
be verified without a live model.
"""

import json

import pytest

from app.services import outline_service
from app.services.outline_service import allocate_chapter_counts, extract_json


async def _create_work(client, *, structure_id: int, planned: int | None = None) -> dict:
    """Create a work via the API (with a stubbed LLM connection configured)."""
    await client.put(
        "/api/settings/connection",
        json={"url": "https://stub/chat", "api_token": "t", "model": "m"},
    )
    body: dict = {"title": "测试作品", "structure_id": structure_id}
    if planned is not None:
        body["planned_chapter_count"] = planned
    response = await client.post("/api/works", json=body)
    assert response.status_code == 201
    return response.json()


async def _three_act_structure_id(client) -> int:
    """Return the id of the preset 三幕式 structure."""
    structures = (await client.get("/api/structures")).json()
    return next(s["id"] for s in structures if s["name"] == "三幕式")


def _patch_llm(monkeypatch, payload) -> None:
    """Patch the outline router's chat_completion to return canned JSON."""

    async def fake_completion(connection, messages, params=None, **kwargs):
        data: object = payload
        if (
            isinstance(payload, list)
            and payload
            and isinstance(payload[0], dict)
            and "chapter_number" in payload[0]
        ):
            data = {"chapters": payload}
        return json.dumps(data, ensure_ascii=False)

    import app.routers.outline as outline_router

    monkeypatch.setattr(outline_router, "chat_completion", fake_completion)


def test_extract_json_handles_code_fences():
    """JSON wrapped in Markdown fences and prose is still parsed."""
    text = "```json\n[{\"a\": 1}]\n```"
    assert extract_json(text) == [{"a": 1}]


def test_allocate_chapter_counts_distributes_remainder():
    """Chapter counts are spread evenly with the remainder going first."""
    assert allocate_chapter_counts(3, 10) == [4, 3, 3]
    assert allocate_chapter_counts(3, 2) == [1, 1, 1]


async def test_generate_stages_creates_tree_and_chapters(client, monkeypatch):
    """Generating stages creates stage rows and the chapter skeleton."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=6)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 2, "overview": "开场"},
            {"name": "对抗", "chapter_count": 3, "overview": "冲突"},
            {"name": "解决", "chapter_count": 1, "overview": "收尾"},
        ],
    )

    response = await client.post(f"/api/works/{work['id']}/outline/stages:generate")
    assert response.status_code == 200
    data = response.json()
    assert [s["name"] for s in data["stages"]] == ["铺垫", "对抗", "解决"]
    assert [s["chapter_count"] for s in data["stages"]] == [2, 3, 1]
    assert len(data["chapters"]) == 6
    assert [c["chapter_number"] for c in data["chapters"]] == [1, 2, 3, 4, 5, 6]
    assert data["locked"] is False


async def test_generate_chapters_fills_summaries_and_locks(client, monkeypatch):
    """Generating chapter outlines fills titles/summaries and locks the work."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=3)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 1, "overview": "c"},
        ],
    )
    await client.post(f"/api/works/{work['id']}/outline/stages:generate")

    calls: list[str] = []

    async def stage_wise_completion(connection, messages, params=None, **kwargs):
        assert kwargs.get("response_format") == {"type": "json_object"}
        user_prompt = messages[-1]["content"]
        calls.append(user_prompt)
        if "请只为阶段「铺垫」" in user_prompt:
            return json.dumps(
                {"chapters": [{"chapter_number": 1, "title": "第一章", "summary": "起"}]},
                ensure_ascii=False,
            )
        if "请只为阶段「对抗」" in user_prompt:
            return json.dumps(
                {"chapters": [{"chapter_number": 2, "title": "第二章", "summary": "承"}]},
                ensure_ascii=False,
            )
        if "请只为阶段「解决」" in user_prompt:
            return json.dumps(
                {"chapters": [{"chapter_number": 3, "title": "第三章", "summary": "合"}]},
                ensure_ascii=False,
            )
        raise AssertionError(f"unexpected stage prompt:\n{user_prompt[:400]}")

    import app.routers.outline as outline_router

    monkeypatch.setattr(outline_router, "chat_completion", stage_wise_completion)
    response = await client.post(f"/api/works/{work['id']}/outline/chapters:generate")
    assert response.status_code == 200
    data = response.json()
    assert data["locked"] is True
    assert data["actual_chapter_count"] == 3
    assert data["chapters"][0]["title"] == "第一章"
    assert data["chapters"][2]["summary"] == "合"
    assert len(calls) == 3
    assert all("各阶段概述与章节归属" in prompt for prompt in calls)
    assert all("【当前任务】" in prompt for prompt in calls)
    assert all('{"chapters":' in prompt or '{"chapters":[...]}' in prompt for prompt in calls)
    assert all("完整闭合" in prompt for prompt in calls)
    assert all("预计章节数" not in prompt for prompt in calls)
    assert all("实际章节数" not in prompt for prompt in calls)


async def test_generate_chapters_retries_incomplete_then_succeeds(client, monkeypatch):
    """Incomplete chapter coverage is retried within a stage before succeeding."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=2)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 2, "overview": "a"},
            {"name": "对抗", "chapter_count": 0, "overview": "b"},
            {"name": "解决", "chapter_count": 0, "overview": "c"},
        ],
    )
    await client.post(f"/api/works/{work['id']}/outline/stages:generate")

    calls = {"n": 0}

    async def flaky_then_ok(connection, messages, params=None, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return json.dumps(
                {"chapters": [{"chapter_number": 1, "title": "只给一章", "summary": "x"}]},
                ensure_ascii=False,
            )
        return json.dumps(
            {
                "chapters": [
                    {"chapter_number": 1, "title": "第一章", "summary": "起"},
                    {"chapter_number": 2, "title": "第二章", "summary": "承"},
                ]
            },
            ensure_ascii=False,
        )

    import app.routers.outline as outline_router

    monkeypatch.setattr(outline_router, "chat_completion", flaky_then_ok)
    response = await client.post(f"/api/works/{work['id']}/outline/chapters:generate")
    assert response.status_code == 200
    data = response.json()
    assert data["chapters"][0]["title"] == "第一章"
    assert data["chapters"][1]["title"] == "第二章"
    assert calls["n"] == 2


async def test_set_stage_chapter_count_adds_and_removes(client, monkeypatch):
    """Adjusting a stage's chapter count adds or removes empty chapters."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=3)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 1, "overview": "c"},
        ],
    )
    outline = (await client.post(f"/api/works/{work['id']}/outline/stages:generate")).json()
    first_stage = outline["stages"][0]["id"]

    grown = (
        await client.put(f"/api/stages/{first_stage}/chapter-count", json={"count": 3})
    ).json()
    assert grown["stages"][0]["chapter_count"] == 3
    assert len(grown["chapters"]) == 5

    shrunk = (
        await client.put(f"/api/stages/{first_stage}/chapter-count", json={"count": 0})
    ).json()
    assert shrunk["stages"][0]["chapter_count"] == 0
    assert len(shrunk["chapters"]) == 2


async def test_chapter_crud_and_reorder(client, monkeypatch):
    """Add, update, reorder, and delete chapters with contiguous numbering."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=2)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 0, "overview": "c"},
        ],
    )
    outline = (await client.post(f"/api/works/{work['id']}/outline/stages:generate")).json()
    chapter_ids = [c["id"] for c in outline["chapters"]]

    added = (await client.post(f"/api/works/{work['id']}/chapters", json={})).json()
    assert added["chapter_number"] == 3
    assert added["stage_id"] is None

    updated = (
        await client.patch(
            f"/api/chapters/{added['id']}", json={"title": "番外", "status": "已完成"}
        )
    ).json()
    assert updated["title"] == "番外"
    assert updated["status"] == "已完成"

    reordered = (
        await client.put(
            f"/api/works/{work['id']}/chapters/reorder",
            json={
                "items": [
                    {"id": added["id"], "stage_id": None},
                    {"id": chapter_ids[0], "stage_id": None},
                    {"id": chapter_ids[1], "stage_id": None},
                ]
            },
        )
    ).json()
    assert reordered["chapters"][0]["id"] == added["id"]
    assert [c["chapter_number"] for c in reordered["chapters"]] == [1, 2, 3]

    assert (await client.delete(f"/api/chapters/{added['id']}")).status_code == 204
    final = (await client.get(f"/api/works/{work['id']}/outline")).json()
    assert [c["chapter_number"] for c in final["chapters"]] == [1, 2]


async def test_reassign_stage_moves_chapter_to_stage_end(client, monkeypatch):
    """Assigning a chapter to an earlier stage regroups it at that stage's end."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=3)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 1, "overview": "c"},
        ],
    )
    outline = (await client.post(f"/api/works/{work['id']}/outline/stages:generate")).json()
    first_stage = outline["stages"][0]["id"]

    added = (await client.post(f"/api/works/{work['id']}/chapters", json={})).json()
    assert added["chapter_number"] == 4

    moved = (
        await client.patch(f"/api/chapters/{added['id']}", json={"stage_id": first_stage})
    ).json()
    assert moved["stage_id"] == first_stage
    assert moved["chapter_number"] == 2

    final = (await client.get(f"/api/works/{work['id']}/outline")).json()
    first_stage_chapters = [c for c in final["chapters"] if c["stage_id"] == first_stage]
    assert [c["chapter_number"] for c in first_stage_chapters] == [1, 2]


async def test_outline_lock_blocks_planned_count_change(client, monkeypatch):
    """Once locked, planned_chapter_count can no longer be changed."""
    structure_id = await _three_act_structure_id(client)
    work = await _create_work(client, structure_id=structure_id, planned=3)
    _patch_llm(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 1, "overview": "c"},
        ],
    )
    await client.post(f"/api/works/{work['id']}/outline/stages:generate")

    async def chapter_completion(connection, messages, params=None, **kwargs):
        user_prompt = messages[-1]["content"]
        if "请只为阶段「铺垫」" in user_prompt:
            items = [{"chapter_number": 1, "title": "t1", "summary": "s1"}]
        elif "请只为阶段「对抗」" in user_prompt:
            items = [{"chapter_number": 2, "title": "t2", "summary": "s2"}]
        else:
            items = [{"chapter_number": 3, "title": "t3", "summary": "s3"}]
        return json.dumps({"chapters": items}, ensure_ascii=False)

    import app.routers.outline as outline_router

    monkeypatch.setattr(outline_router, "chat_completion", chapter_completion)
    assert (await client.post(f"/api/works/{work['id']}/outline/chapters:generate")).status_code == 200

    response = await client.patch(f"/api/works/{work['id']}", json={"planned_chapter_count": 9})
    assert response.status_code == 409


async def test_generate_stages_requires_structure_with_stages(client, monkeypatch):
    """Generating stages fails for a work without a staged structure."""
    work = await _create_work(client, structure_id=await _no_structure_id(client))
    response = await client.post(f"/api/works/{work['id']}/outline/stages:generate")
    assert response.status_code == 400


async def _no_structure_id(client) -> int:
    """Return the id of the preset 无 (no structure) entry."""
    structures = (await client.get("/api/structures")).json()
    return next(s["id"] for s in structures if s["name"] == "无")


async def test_generate_stages_injects_referenced_entities(client, monkeypatch):
    """`@`-referenced setting entries are injected into the generation prompt."""
    structure_id = await _three_act_structure_id(client)
    await client.put(
        "/api/settings/connection",
        json={"url": "https://stub/chat", "api_token": "t", "model": "m"},
    )
    work = (
        await client.post(
            "/api/works",
            json={
                "title": "魔法学院",
                "structure_id": structure_id,
                "summary": "故事围绕 @魔法石 展开",
            },
        )
    ).json()

    categories = (await client.get(f"/api/works/{work['id']}/categories")).json()
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={
            "category_id": categories[0]["id"],
            "name": "魔法石",
            "description": "蕴含远古力量的宝石",
            "properties": [{"name": "颜色", "value": "赤红"}],
        },
    )

    captured: dict = {}

    async def capturing_completion(connection, messages, params=None, **kwargs):
        captured["messages"] = messages
        return json.dumps(
            [{"name": "铺垫", "chapter_count": 1, "overview": "x"}], ensure_ascii=False
        )

    import app.routers.outline as outline_router

    monkeypatch.setattr(outline_router, "chat_completion", capturing_completion)

    response = await client.post(f"/api/works/{work['id']}/outline/stages:generate")
    assert response.status_code == 200

    user_prompt = captured["messages"][-1]["content"]
    assert "【引用设定】" in user_prompt
    assert "魔法石" in user_prompt
    assert "蕴含远古力量的宝石" in user_prompt
    assert "颜色=赤红" in user_prompt


def test_extract_json_raises_on_garbage():
    """A response with no JSON raises a ValueError."""
    with pytest.raises(ValueError):
        outline_service.extract_json("no json here")


def test_extract_chapter_outline_items_accepts_object_and_array():
    """Chapter outlines may be wrapped in ``chapters`` or returned as an array."""
    from app.services.outline_service import (
        extract_chapter_outline_items,
        index_chapter_outline_items,
    )

    wrapped = extract_chapter_outline_items(
        '{"chapters":[{"chapter_number":1,"title":"A","summary":"s"}]}'
    )
    assert wrapped[0]["title"] == "A"
    bare = extract_chapter_outline_items('[{"chapter_number":2,"title":"B","summary":"t"}]')
    assert bare[0]["chapter_number"] == 2
    indexed = index_chapter_outline_items(wrapped + bare, allowed_numbers=[1, 2])
    assert set(indexed) == {1, 2}


def test_response_tail_and_parse_failure_helpers():
    """Parse-failure helpers expose usage metadata and response tails."""
    from app.services.llm_service import ChatCompletionResult
    from app.services.outline_service import log_llm_parse_failure, response_tail

    assert response_tail("short") == "short"
    assert response_tail("x" * 900).startswith("x")
    assert len(response_tail("x" * 900)) == 800

    result = ChatCompletionResult(
        '[{"chapter_number": 1, "title": "A", "summary": "half',
        finish_reason="stop",
        usage={"completion_tokens": 120, "prompt_tokens": 800},
    )
    log_llm_parse_failure(context="unit-test", content=result, error=ValueError("bad json"))

