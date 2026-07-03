"""Tests for the work export and snapshot endpoints.

Covers JSON / Markdown export downloads (``STORY_PAGE_DESIGN.md`` §2.5) and the
filesystem snapshot writer with history rotation (``DATA_STORAGE_DESIGN.md`` §8).
LLM calls are patched so outline generation works without a live model.
"""

import io
import json
import zipfile

import app.routers.export as export_router
import app.routers.outline as outline_router


def _patch_outline(monkeypatch, value) -> None:
    """Patch the outline router's chat_completion to return canned JSON."""

    async def fake_completion(connection, messages, params=None):
        return json.dumps(value, ensure_ascii=False)

    monkeypatch.setattr(outline_router, "chat_completion", fake_completion)


async def _setup_work(client, monkeypatch) -> dict:
    """Create a work, generate a 3-chapter skeleton, and fill one chapter body."""
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
    _patch_outline(
        monkeypatch,
        [
            {"name": "铺垫", "chapter_count": 1, "overview": "a"},
            {"name": "对抗", "chapter_count": 1, "overview": "b"},
            {"name": "解决", "chapter_count": 1, "overview": "c"},
        ],
    )
    outline = (await client.post(f"/api/works/{work['id']}/outline/stages:generate")).json()
    chapter_id = outline["chapters"][0]["id"]
    await client.put(
        f"/api/chapters/{chapter_id}/content",
        json={"content": "这是第一章的正文内容。"},
    )
    return work


async def test_export_json_includes_chapters_and_content(client, monkeypatch, tmp_path):
    """JSON export contains work info, structure stages, and chapter bodies."""
    monkeypatch.setattr(export_router, "exports_dir", lambda: tmp_path)
    work = await _setup_work(client, monkeypatch)

    response = await client.get(f"/api/works/{work['id']}/export", params={"format": "json"})
    assert response.status_code == 200
    data = response.json()
    assert data["work"]["title"] == "测试作品"
    assert data["structure"]["name"] == "三幕式"
    assert len(data["chapters"]) == 3
    assert data["chapters"][0]["content"] == "这是第一章的正文内容。"


async def test_export_markdown_has_headings(client, monkeypatch, tmp_path):
    """Markdown export starts with the title and renders chapter headings."""
    monkeypatch.setattr(export_router, "exports_dir", lambda: tmp_path)
    work = await _setup_work(client, monkeypatch)

    response = await client.get(f"/api/works/{work['id']}/export", params={"format": "md"})
    assert response.status_code == 200
    text = response.text
    assert text.startswith("# 测试作品")
    assert "## 第1章" in text
    assert "这是第一章的正文内容。" in text


async def test_export_chapters_zip_skips_empty(client, monkeypatch, tmp_path):
    """Chapter zip includes only non-empty chapters under a folder named after the work."""
    monkeypatch.setattr(export_router, "exports_dir", lambda: tmp_path)
    work = await _setup_work(client, monkeypatch)

    response = await client.get(
        f"/api/works/{work['id']}/export", params={"format": "chapters"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = archive.namelist()
        assert len(names) == 1
        assert names[0].startswith("测试作品/")
        assert names[0].endswith(".md")
        body = archive.read(names[0]).decode("utf-8")
        assert "# 第1章" in body
        assert "这是第一章的正文内容。" in body


async def test_export_chapters_returns_400_when_no_body(client, monkeypatch, tmp_path):
    """Chapter export fails when every chapter has an empty body."""
    monkeypatch.setattr(export_router, "exports_dir", lambda: tmp_path)
    work = await _setup_work(client, monkeypatch)
    chapter_id = (
        await client.get(f"/api/works/{work['id']}/outline")
    ).json()["chapters"][0]["id"]
    await client.put(f"/api/chapters/{chapter_id}/content", json={"content": ""})

    response = await client.get(
        f"/api/works/{work['id']}/export", params={"format": "chapters"}
    )
    assert response.status_code == 400
    assert "没有可导出的章节正文" in response.text


async def test_export_unknown_work_returns_404(client, monkeypatch, tmp_path):
    """Exporting a missing work yields a 404."""
    monkeypatch.setattr(export_router, "exports_dir", lambda: tmp_path)
    response = await client.get("/api/works/9999/export")
    assert response.status_code == 404


async def test_snapshot_writes_outline_scenes_and_chapters(client, monkeypatch, tmp_path):
    """A snapshot writes outline.json, scenes.json, and per-chapter markdown."""
    work = await _setup_work(client, monkeypatch)
    await client.put(
        "/api/settings/data_save",
        json={
            "input_debounce_seconds": 2,
            "autosave_interval_seconds": 30,
            "snapshot_path": str(tmp_path),
            "history_versions": 3,
        },
    )

    response = await client.post(f"/api/works/{work['id']}/snapshot")
    assert response.status_code == 200
    assert response.json()["chapters"] == 3

    work_dir = tmp_path / str(work["id"])
    assert (work_dir / "outline.json").exists()
    assert (work_dir / "scenes.json").exists()
    assert (work_dir / "chapters" / "1.md").read_text(encoding="utf-8") == "这是第一章的正文内容。"

    outline = json.loads((work_dir / "outline.json").read_text(encoding="utf-8"))
    assert outline["work"]["title"] == "测试作品"
    assert len(outline["stages"]) == 3


async def test_snapshot_rotates_history_versions(client, monkeypatch, tmp_path):
    """Re-snapshotting rotates the previous file into a numbered history version."""
    work = await _setup_work(client, monkeypatch)
    await client.put(
        "/api/settings/data_save",
        json={
            "input_debounce_seconds": 2,
            "autosave_interval_seconds": 30,
            "snapshot_path": str(tmp_path),
            "history_versions": 2,
        },
    )

    await client.post(f"/api/works/{work['id']}/snapshot")
    await client.post(f"/api/works/{work['id']}/snapshot")

    work_dir = tmp_path / str(work["id"])
    assert (work_dir / "outline.json").exists()
    assert (work_dir / "outline.2.json").exists()


async def test_snapshot_unknown_work_returns_404(client):
    """Snapshotting a missing work yields a 404."""
    response = await client.post("/api/works/9999/snapshot")
    assert response.status_code == 404
