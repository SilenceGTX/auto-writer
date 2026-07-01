"""Filesystem snapshot persistence for works (``DATA_STORAGE_DESIGN.md`` §8.1).

On the periodic auto-save tick the backend mirrors a work's outline, scene
breakdown, and chapter bodies onto disk as a backup of the SQLite database
(which always remains the single source of truth). Outline / scenes are stored
as ``.json`` and chapter bodies as ``.md`` under a configurable snapshot root;
previous versions are rotated into numbered files (newer = larger ``n``) up to
the configured ``history_versions`` limit.
"""

import json
from pathlib import Path

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.models import Work
from app.services.export_service import load_chapters_with_scenes
from app.services.settings_service import DATA_SAVE_KEY, get_setting

SNAPSHOTS_DIRNAME = "snapshots"
EXPORTS_DIRNAME = "exports"


def data_dir() -> Path:
    """Return the base ``data/`` directory derived from the database location."""
    prefix = "sqlite+aiosqlite:///"
    url = settings.database_url
    if url.startswith(prefix):
        db_path = url.removeprefix(prefix)
        if db_path != ":memory:":
            return Path(db_path).expanduser().resolve().parent
    return Path("data").resolve()


def exports_dir() -> Path:
    """Return the directory used for manual export files (created on demand)."""
    path = data_dir() / EXPORTS_DIRNAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def _snapshot_root(snapshot_path: str) -> Path:
    """Resolve the snapshot root; relative paths sit beside the data directory."""
    path = Path(snapshot_path).expanduser()
    if path.is_absolute():
        return path
    # Relative paths like "data/snapshots" are resolved against the repo root
    # (the parent of the data directory) so they land under the ignored data/.
    return data_dir().parent / path


def _versioned(path: Path, version: int) -> Path:
    """Return the history filename for a version, e.g. ``outline.json`` -> ``outline.2.json``."""
    return path.with_name(f"{path.stem}.{version}{path.suffix}")


def _rotate_and_write(path: Path, content: str, history_versions: int) -> None:
    """Rotate existing versions, then write ``content`` as the current snapshot file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and history_versions > 0:
        oldest = _versioned(path, 1)
        if oldest.exists():
            oldest.unlink()
        for version in range(2, history_versions + 1):
            src = _versioned(path, version)
            if src.exists():
                src.rename(_versioned(path, version - 1))
        path.rename(_versioned(path, history_versions))
    path.write_text(content, encoding="utf-8")


def _build_outline_snapshot(work: Work, stages: list, chapters: list) -> dict:
    """Assemble the ``outline.json`` payload (stage tree + chapter outlines)."""
    chapters_by_stage: dict[int | None, list] = {}
    for chapter in chapters:
        chapters_by_stage.setdefault(chapter.stage_id, []).append(chapter)

    def chapter_entries(items: list) -> list[dict]:
        """Map chapters to their outline fields."""
        return [
            {"chapter_number": c.chapter_number, "title": c.title, "summary": c.summary}
            for c in items
        ]

    stage_blocks = [
        {
            "name": stage.name,
            "overview": stage.overview,
            "chapters": chapter_entries(chapters_by_stage.get(stage.id, [])),
        }
        for stage in stages
    ]
    unassigned = chapters_by_stage.get(None, [])
    if unassigned:
        stage_blocks.append(
            {"name": None, "overview": None, "chapters": chapter_entries(unassigned)}
        )
    return {
        "work": {"title": work.title, "summary": work.summary, "status": work.status},
        "stages": stage_blocks,
    }


def _build_scenes_snapshot(chapters: list) -> dict:
    """Assemble the ``scenes.json`` payload (per-chapter scene breakdown)."""
    return {
        "chapters": [
            {
                "chapter_number": chapter.chapter_number,
                "scenes": [
                    {
                        "sort_order": scene.sort_order,
                        "title": scene.title,
                        "description": scene.description,
                    }
                    for scene in sorted(chapter.scenes, key=lambda s: s.sort_order)
                ],
            }
            for chapter in chapters
            if chapter.scenes
        ]
    }


async def write_work_snapshot(db: AsyncSession, work: Work) -> dict | None:
    """Write outline/scenes/chapter snapshots for a work, rotating history versions.

    Returns a summary of the snapshot directory and file counts, or ``None`` when
    the work has no chapters to persist.
    """
    data_save = await get_setting(db, DATA_SAVE_KEY)
    history_versions = int(data_save.get("history_versions", 3))
    root = _snapshot_root(str(data_save.get("snapshot_path", "data/snapshots")))
    work_dir = root / str(work.id)

    stages = sorted(work.stages, key=lambda s: s.sort_order)
    chapters = await load_chapters_with_scenes(db, work.id)

    outline = _build_outline_snapshot(work, stages, chapters)
    scenes = _build_scenes_snapshot(chapters)

    _rotate_and_write(
        work_dir / "outline.json",
        json.dumps(outline, ensure_ascii=False, indent=2),
        history_versions,
    )
    _rotate_and_write(
        work_dir / "scenes.json",
        json.dumps(scenes, ensure_ascii=False, indent=2),
        history_versions,
    )
    chapters_dir = work_dir / "chapters"
    for chapter in chapters:
        _rotate_and_write(
            chapters_dir / f"{chapter.chapter_number}.md",
            chapter.content or "",
            history_versions,
        )

    logger.info("写入作品 {} 快照：{} 章，目录 {}", work.id, len(chapters), work_dir)
    return {"snapshot_dir": str(work_dir), "chapters": len(chapters)}
