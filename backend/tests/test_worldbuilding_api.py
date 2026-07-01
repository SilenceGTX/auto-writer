"""Tests for the worldbuilding endpoints (categories and entries).

Covers the four default preset categories seeded on work creation, custom
category create / delete (with entry cascade and preset protection), entry CRUD
with JSON properties, list filtering / search / pagination, and the per-category
property-name candidate set.
"""


async def _create_work(client) -> dict:
    """Create a work via the API (which seeds the four default categories)."""
    response = await client.post("/api/works", json={"title": "测试作品"})
    assert response.status_code == 201
    return response.json()


async def _category_id(client, work_id: int, name: str) -> int:
    """Return the id of a work's category by name."""
    categories = (await client.get(f"/api/works/{work_id}/categories")).json()
    return next(c["id"] for c in categories if c["name"] == name)


async def test_new_work_seeds_preset_categories(client):
    """A new work exposes the four preset categories, all marked preset."""
    work = await _create_work(client)
    categories = (await client.get(f"/api/works/{work['id']}/categories")).json()
    assert [c["name"] for c in categories] == ["人物", "地点", "物品", "概念"]
    assert all(c["is_preset"] == 1 for c in categories)
    assert all(c["entity_count"] == 0 for c in categories)


async def test_create_and_reject_duplicate_category(client):
    """Custom categories can be added but duplicate names are rejected."""
    work = await _create_work(client)
    created = await client.post(
        f"/api/works/{work['id']}/categories", json={"name": "组织"}
    )
    assert created.status_code == 201
    assert created.json()["is_preset"] == 0

    duplicate = await client.post(
        f"/api/works/{work['id']}/categories", json={"name": "组织"}
    )
    assert duplicate.status_code == 409


async def test_preset_category_cannot_be_deleted(client):
    """Deleting a preset category is rejected with 409."""
    work = await _create_work(client)
    category_id = await _category_id(client, work["id"], "人物")
    response = await client.delete(f"/api/categories/{category_id}")
    assert response.status_code == 409


async def test_delete_category_cascades_entries(client):
    """Deleting a custom category removes its entries too."""
    work = await _create_work(client)
    created = (
        await client.post(f"/api/works/{work['id']}/categories", json={"name": "组织"})
    ).json()
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={"category_id": created["id"], "name": "公会"},
    )

    response = await client.delete(f"/api/categories/{created['id']}")
    assert response.status_code == 204

    listing = (await client.get(f"/api/works/{work['id']}/entities")).json()
    assert listing["total"] == 0


async def test_entity_crud_with_properties(client):
    """Entries round-trip their name, description, and ordered properties."""
    work = await _create_work(client)
    category_id = await _category_id(client, work["id"], "人物")

    created = await client.post(
        f"/api/works/{work['id']}/entities",
        json={
            "category_id": category_id,
            "name": "张三",
            "description": "主角",
            "properties": [
                {"name": "年龄", "value": "24"},
                {"name": "身份", "value": "骑士"},
            ],
        },
    )
    assert created.status_code == 201
    entity = created.json()
    assert entity["properties"][0] == {"name": "年龄", "value": "24"}

    updated = await client.patch(
        f"/api/entities/{entity['id']}",
        json={"name": "张三丰", "properties": [{"name": "门派", "value": "武当"}]},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "张三丰"
    assert updated.json()["properties"] == [{"name": "门派", "value": "武当"}]

    deleted = await client.delete(f"/api/entities/{entity['id']}")
    assert deleted.status_code == 204


async def test_list_entities_filters_search_and_paginates(client):
    """Listing supports category filtering, name search, and pagination."""
    work = await _create_work(client)
    person_id = await _category_id(client, work["id"], "人物")
    place_id = await _category_id(client, work["id"], "地点")

    for name in ("张三", "李四", "王五"):
        await client.post(
            f"/api/works/{work['id']}/entities",
            json={"category_id": person_id, "name": name},
        )
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={"category_id": place_id, "name": "洛阳城"},
    )

    by_category = (
        await client.get(f"/api/works/{work['id']}/entities?category_id={person_id}")
    ).json()
    assert by_category["total"] == 3

    searched = (
        await client.get(f"/api/works/{work['id']}/entities?search=洛阳")
    ).json()
    assert searched["total"] == 1
    assert searched["items"][0]["name"] == "洛阳城"

    page = (
        await client.get(f"/api/works/{work['id']}/entities?page=1&page_size=2")
    ).json()
    assert page["total"] == 4
    assert len(page["items"]) == 2


async def test_property_name_candidates_ranked_by_frequency(client):
    """Property-name candidates are deduplicated and ranked by frequency."""
    work = await _create_work(client)
    category_id = await _category_id(client, work["id"], "人物")
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={
            "category_id": category_id,
            "name": "甲",
            "properties": [{"name": "年龄", "value": "1"}, {"name": "性别", "value": "男"}],
        },
    )
    await client.post(
        f"/api/works/{work['id']}/entities",
        json={
            "category_id": category_id,
            "name": "乙",
            "properties": [{"name": "年龄", "value": "2"}],
        },
    )

    names = (await client.get(f"/api/categories/{category_id}/property-names")).json()
    assert names[0] == "年龄"
    assert set(names) == {"年龄", "性别"}
