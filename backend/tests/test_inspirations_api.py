"""Tests for the inspiration capture endpoints (create, list, delete)."""


async def test_create_and_list_inspiration_with_source(client):
    """An inspiration is stored with its source references and listed back."""
    work = (await client.post("/api/works", json={"title": "测试作品"})).json()
    created = (
        await client.post(
            "/api/inspirations",
            json={
                "content": "一个关于背叛的转折",
                "source_page": "outline",
                "work_id": work["id"],
            },
        )
    ).json()
    assert created["content"] == "一个关于背叛的转折"
    assert created["source_page"] == "outline"
    assert created["work_id"] == work["id"]

    listed = (await client.get("/api/inspirations")).json()
    assert any(item["id"] == created["id"] for item in listed)


async def test_list_filters_by_source_and_search(client):
    """Listing supports filtering by source page and fuzzy content search."""
    await client.post("/api/inspirations", json={"content": "海上的灯塔", "source_page": "writing"})
    await client.post("/api/inspirations", json={"content": "森林的低语", "source_page": "outline"})

    writing_only = (await client.get("/api/inspirations?source_page=writing")).json()
    assert [item["content"] for item in writing_only] == ["海上的灯塔"]

    searched = (await client.get("/api/inspirations?search=森林")).json()
    assert [item["content"] for item in searched] == ["森林的低语"]


async def test_delete_inspiration(client):
    """An inspiration can be deleted and is then absent from the list."""
    created = (await client.post("/api/inspirations", json={"content": "待删除"})).json()
    assert (await client.delete(f"/api/inspirations/{created['id']}")).status_code == 204
    remaining = (await client.get("/api/inspirations")).json()
    assert all(item["id"] != created["id"] for item in remaining)


async def test_create_rejects_empty_content(client):
    """Empty content is rejected by validation."""
    response = await client.post("/api/inspirations", json={"content": ""})
    assert response.status_code == 422


async def test_create_tag_is_idempotent_by_name(client):
    """Creating a tag with an existing name returns the same tag."""
    first = (await client.post("/api/tags", json={"name": "转折", "color": "#4f46e5"})).json()
    second = (await client.post("/api/tags", json={"name": "转折"})).json()
    assert first["id"] == second["id"]
    listed = (await client.get("/api/tags")).json()
    assert [tag["name"] for tag in listed] == ["转折"]


async def test_set_inspiration_tags_and_filter(client):
    """Tags can be attached to an inspiration and used to filter the list."""
    tag = (await client.post("/api/tags", json={"name": "人物", "color": "#16a34a"})).json()
    a = (await client.post("/api/inspirations", json={"content": "一个反派的动机"})).json()
    (await client.post("/api/inspirations", json={"content": "无标签的灵感"})).json()

    updated = (
        await client.put(f"/api/inspirations/{a['id']}/tags", json={"tag_ids": [tag["id"]]})
    ).json()
    assert [t["name"] for t in updated["tags"]] == ["人物"]

    by_tag = (await client.get(f"/api/inspirations?tag_id={tag['id']}")).json()
    assert [item["id"] for item in by_tag] == [a["id"]]


async def test_clearing_inspiration_tags(client):
    """Setting an empty tag list detaches all tags from the inspiration."""
    tag = (await client.post("/api/tags", json={"name": "设定"})).json()
    insp = (await client.post("/api/inspirations", json={"content": "世界观碎片"})).json()
    await client.put(f"/api/inspirations/{insp['id']}/tags", json={"tag_ids": [tag["id"]]})

    cleared = (
        await client.put(f"/api/inspirations/{insp['id']}/tags", json={"tag_ids": []})
    ).json()
    assert cleared["tags"] == []


async def test_delete_tag_detaches_from_inspirations(client):
    """Deleting a tag removes it from inspirations (cascade) but keeps them."""
    tag = (await client.post("/api/tags", json={"name": "废弃"})).json()
    insp = (await client.post("/api/inspirations", json={"content": "保留的灵感"})).json()
    await client.put(f"/api/inspirations/{insp['id']}/tags", json={"tag_ids": [tag["id"]]})

    assert (await client.delete(f"/api/tags/{tag['id']}")).status_code == 204
    remaining = (await client.get("/api/inspirations")).json()
    target = next(item for item in remaining if item["id"] == insp["id"])
    assert target["tags"] == []
