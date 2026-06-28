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
