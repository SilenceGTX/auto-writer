"""Tests for the Phase 0 works/series/structures endpoints."""

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


async def test_list_works(client):
    """Created works appear in the listing endpoint."""
    await client.post("/api/works", json={"title": "作品 A"})
    await client.post("/api/works", json={"title": "作品 B"})

    response = await client.get("/api/works")
    assert response.status_code == 200
    titles = {item["title"] for item in response.json()}
    assert {"作品 A", "作品 B"} <= titles


async def test_create_work_rejects_unknown_series(client):
    """Creating a work with a non-existent series id returns 404."""
    response = await client.post("/api/works", json={"title": "X", "series_id": 9999})
    assert response.status_code == 404
