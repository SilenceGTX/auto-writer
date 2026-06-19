"""YAML export service for scene and plot item persistence to disk."""

import os
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models import Chapter, PlotItem, Scene, Story


async def export_scene_yaml(scene_id: int, base_dir: str, db: AsyncSession) -> str:
    """Export a single scene and its plot items as a YAML file.

    Returns the file path written.
    """
    result = await db.execute(
        select(Scene)
        .options(
            joinedload(Scene.chapter).joinedload(Chapter.story),
            joinedload(Scene.plot_items),
        )
        .where(Scene.id == scene_id)
    )
    scene = result.unique().scalar_one_or_none()
    if not scene:
        raise ValueError(f"Scene {scene_id} not found")

    chapter = scene.chapter
    story = chapter.story

    # Build directory path: base_dir/series/story/chapter/scene_id/
    dir_parts = [base_dir]
    # Series name (if any) — use story title as folder-safe name
    safe_story = _safe_name(story.title)
    safe_chapter = _safe_name(f"{chapter.order:03d}_{chapter.title}")
    dir_parts.extend([safe_story, safe_chapter, f"scene_{scene.id:03d}"])

    dir_path = Path(*dir_parts)
    dir_path.mkdir(parents=True, exist_ok=True)

    # Build YAML content
    data = {
        "scene": {
            "id": scene.id,
            "title": scene.title,
            "description": scene.description,
            "order": scene.order,
        },
        "chapter": {
            "id": chapter.id,
            "title": chapter.title,
            "order": chapter.order,
        },
        "story": {
            "id": story.id,
            "title": story.title,
        },
        "plot_items": [
            {
                "id": item.id,
                "type": item.item_type,
                "description": item.description,
                "order": item.order,
            }
            for item in scene.plot_items
        ],
    }

    file_path = dir_path / "scene.yml"
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    return str(file_path)


async def export_chapter_yaml(chapter_id: int, base_dir: str, db: AsyncSession) -> list[str]:
    """Export all scenes under a chapter as YAML files. Returns list of file paths."""
    result = await db.execute(
        select(Scene)
        .options(joinedload(Scene.plot_items))
        .where(Scene.chapter_id == chapter_id)
        .order_by(Scene.order)
    )
    scenes = result.unique().scalars().all()

    # Load chapter+story for the directory structure
    ch_result = await db.execute(
        select(Chapter).options(joinedload(Chapter.story)).where(Chapter.id == chapter_id)
    )
    chapter = ch_result.unique().scalar_one_or_none()
    if not chapter:
        raise ValueError(f"Chapter {chapter_id} not found")

    story = chapter.story
    safe_story = _safe_name(story.title)
    safe_chapter = _safe_name(f"{chapter.order:03d}_{chapter.title}")

    paths = []
    for scene in scenes:
        dir_path = Path(base_dir, safe_story, safe_chapter, f"scene_{scene.id:03d}")
        dir_path.mkdir(parents=True, exist_ok=True)

        data = {
            "scene": {
                "id": scene.id,
                "title": scene.title,
                "description": scene.description,
                "order": scene.order,
            },
            "chapter": {"id": chapter.id, "title": chapter.title, "order": chapter.order},
            "story": {"id": story.id, "title": story.title},
            "plot_items": [
                {
                    "id": item.id,
                    "type": item.item_type,
                    "description": item.description,
                    "order": item.order,
                }
                for item in scene.plot_items
            ],
        }

        file_path = dir_path / "scene.yml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        paths.append(str(file_path))

    return paths


def get_default_export_dir() -> str:
    """Return the default YAML export base directory."""
    return os.environ.get("AW_EXPORT_DIR", os.path.join(os.getcwd(), "data", "exports"))


def _safe_name(name: str) -> str:
    """Convert a string to a filesystem-safe directory name."""
    safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in name)
    return safe.strip().replace(" ", "_") or "unnamed"
