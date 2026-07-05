"""Tests for the works / series / structures endpoints (Phase 1)."""

from sqlalchemy import select

from app.models import EntityCategory
from app.services.seed import DEFAULT_ENTITY_CATEGORIES


async def test_structures_endpoint_returns_presets(client):
    """GET /api/structures returns presets with parsed stage lists."""
    response = await client.get("/api/structures")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 5
    three_act = next(item for item in data if item["name"] == "三幕式")
    assert three_act["stages"] == ["铺垫", "对抗", "解决"]
    assert three_act["is_preset"] == 1


async def test_create_custom_structure(client):
    """POST /api/structures creates a non-preset structure with stored stages."""
    response = await client.post(
        "/api/structures",
        json={"name": "自定义结构", "stages": ["起因", "经过", "结果"], "description": "测试"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["is_preset"] == 0
    assert body["stages"] == ["起因", "经过", "结果"]

    listing = await client.get("/api/structures")
    assert any(item["name"] == "自定义结构" for item in listing.json())


async def test_create_work_seeds_default_categories(client, session):
    """Creating a work seeds its four preset worldbuilding categories."""
    response = await client.post("/api/works", json={"title": "测试作品"})
    assert response.status_code == 201
    work_id = response.json()["id"]

    result = await session.execute(
        select(EntityCategory)
        .where(EntityCategory.work_id == work_id)
        .order_by(EntityCategory.sort_order)
    )
    categories = result.scalars().all()

    assert [category.name for category in categories] == DEFAULT_ENTITY_CATEGORIES
    assert all(category.is_preset == 1 for category in categories)


async def test_list_works_returns_paginated_shape(client):
    """The list endpoint returns an items/total envelope."""
    await client.post("/api/works", json={"title": "作品 A"})
    await client.post("/api/works", json={"title": "作品 B"})

    response = await client.get("/api/works")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    titles = {item["title"] for item in body["items"]}
    assert {"作品 A", "作品 B"} <= titles


async def test_list_works_pagination(client):
    """Pagination limits page size and reports the full total."""
    for index in range(12):
        await client.post("/api/works", json={"title": f"作品 {index}"})

    page1 = (await client.get("/api/works", params={"page": 1, "page_size": 10})).json()
    assert page1["total"] == 12
    assert len(page1["items"]) == 10

    page2 = (await client.get("/api/works", params={"page": 2, "page_size": 10})).json()
    assert len(page2["items"]) == 2


async def test_list_works_search_matches_series_name(client):
    """Search matches both the work title and its series name."""
    series_id = (await client.post("/api/series", json={"name": "玄幻系列"})).json()["id"]
    await client.post("/api/works", json={"title": "斩龙记", "series_id": series_id})
    await client.post("/api/works", json={"title": "都市日常"})

    by_series = (await client.get("/api/works", params={"search": "玄幻"})).json()
    assert {item["title"] for item in by_series["items"]} == {"斩龙记"}

    by_title = (await client.get("/api/works", params={"search": "都市"})).json()
    assert {item["title"] for item in by_title["items"]} == {"都市日常"}


async def test_list_works_sort_by_title_asc(client):
    """Sorting honours the requested column and order."""
    await client.post("/api/works", json={"title": "丙"})
    await client.post("/api/works", json={"title": "甲"})
    await client.post("/api/works", json={"title": "乙"})

    response = await client.get("/api/works", params={"sort_by": "title", "order": "asc"})
    titles = [item["title"] for item in response.json()["items"]]
    assert titles == sorted(titles)


async def test_work_read_includes_display_names(client):
    """Created works expose series_name and structure_name for the list view."""
    series_id = (await client.post("/api/series", json={"name": "我的系列"})).json()["id"]
    structures = (await client.get("/api/structures")).json()
    structure_id = next(s["id"] for s in structures if s["name"] == "三幕式")

    created = (
        await client.post(
            "/api/works",
            json={"title": "带名字的作品", "series_id": series_id, "structure_id": structure_id},
        )
    ).json()
    assert created["series_name"] == "我的系列"
    assert created["structure_name"] == "三幕式"


async def test_update_work(client):
    """PATCH updates only the provided fields and returns the new state."""
    work_id = (await client.post("/api/works", json={"title": "原标题"})).json()["id"]

    response = await client.patch(
        f"/api/works/{work_id}", json={"title": "新标题", "status": "已完成"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "新标题"
    assert body["status"] == "已完成"


async def test_create_work_rejects_unknown_series(client):
    """Creating a work with a non-existent series id returns 404."""
    response = await client.post("/api/works", json={"title": "X", "series_id": 9999})
    assert response.status_code == 404


async def test_delete_series_nulls_member_works(client):
    """Deleting a series leaves member works but clears their series_id."""
    series_id = (await client.post("/api/series", json={"name": "待删系列"})).json()["id"]
    work_id = (
        await client.post("/api/works", json={"title": "成员作品", "series_id": series_id})
    ).json()["id"]

    delete = await client.delete(f"/api/series/{series_id}")
    assert delete.status_code == 204

    works = (await client.get("/api/works")).json()["items"]
    target = next(item for item in works if item["id"] == work_id)
    assert target["series_id"] is None


async def test_list_works_includes_written_chapter_counts(client, monkeypatch):
    """List items expose written/total chapter counts for progress display."""
    import json

    import app.routers.outline as outline_router

    await client.put(
        "/api/settings/connection",
        json={"url": "https://stub/chat", "api_token": "t", "model": "m"},
    )

    async def fake_stages(connection, messages, params=None):
        return json.dumps(
            [
                {"name": "铺垫", "chapter_count": 1, "overview": "a"},
                {"name": "对抗", "chapter_count": 1, "overview": "b"},
                {"name": "解决", "chapter_count": 1, "overview": "c"},
            ],
            ensure_ascii=False,
        )

    monkeypatch.setattr(outline_router, "chat_completion", fake_stages)

    structures = (await client.get("/api/structures")).json()
    structure_id = next(s["id"] for s in structures if s["name"] == "三幕式")
    work = (
        await client.post(
            "/api/works",
            json={"title": "进度作品", "structure_id": structure_id, "planned_chapter_count": 3},
        )
    ).json()
    outline = (await client.post(f"/api/works/{work['id']}/outline/stages:generate")).json()
    assert outline["chapters"]

    async def fake_chapters(connection, messages, params=None):
        return json.dumps(
            [
                {"chapter_number": 1, "title": "第一章", "summary": "起"},
                {"chapter_number": 2, "title": "第二章", "summary": "承"},
                {"chapter_number": 3, "title": "第三章", "summary": "合"},
            ],
            ensure_ascii=False,
        )

    monkeypatch.setattr(outline_router, "chat_completion", fake_chapters)
    await client.post(f"/api/works/{work['id']}/outline/chapters:generate")

    chapter_id = outline["chapters"][0]["id"]
    await client.put(f"/api/chapters/{chapter_id}/content", json={"content": "第一章正文。"})

    items = (await client.get("/api/works")).json()["items"]
    listed = next(item for item in items if item["id"] == work["id"])
    assert listed["written_chapter_count"] == 1
    assert listed["chapter_count"] == 3
    assert listed["actual_chapter_count"] == 3
