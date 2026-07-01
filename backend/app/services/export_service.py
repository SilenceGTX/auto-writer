"""Work export builders: full structured JSON and Markdown manuscript.

Implements ``STORY_PAGE_DESIGN.md`` §2.5 / ``DATA_STORAGE_DESIGN.md`` §8.2. The
JSON export is a structured snapshot of a work (info, structure, stages/overview,
chapters with outline + body, scenes, and worldbuilding entries) for backup and
migration; the Markdown export concatenates the chapter bodies in order for
reading or external archival.
"""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Chapter, EntityCategory, Work, WorkStage, WorldEntity


async def _load_work(db: AsyncSession, work_id: int) -> Work | None:
    """Load a work with its series and structure for export, or None."""
    result = await db.execute(
        select(Work)
        .options(selectinload(Work.series), selectinload(Work.structure))
        .where(Work.id == work_id)
    )
    return result.scalar_one_or_none()


async def load_chapters_with_scenes(db: AsyncSession, work_id: int) -> list[Chapter]:
    """Load a work's chapters (with scenes) ordered by chapter number."""
    result = await db.execute(
        select(Chapter)
        .options(selectinload(Chapter.scenes))
        .where(Chapter.work_id == work_id)
        .order_by(Chapter.chapter_number)
    )
    return list(result.scalars().all())


async def build_work_export_json(db: AsyncSession, work_id: int) -> dict | None:
    """Build the full structured export document for a work, or None if missing."""
    work = await _load_work(db, work_id)
    if work is None:
        return None

    stages = (
        (
            await db.execute(
                select(WorkStage)
                .where(WorkStage.work_id == work_id)
                .order_by(WorkStage.sort_order)
            )
        )
        .scalars()
        .all()
    )
    chapters = await load_chapters_with_scenes(db, work_id)
    categories = (
        (
            await db.execute(
                select(EntityCategory)
                .where(EntityCategory.work_id == work_id)
                .order_by(EntityCategory.sort_order)
            )
        )
        .scalars()
        .all()
    )
    entities = (
        (
            await db.execute(
                select(WorldEntity)
                .where(WorldEntity.work_id == work_id)
                .order_by(WorldEntity.category_id, WorldEntity.sort_order)
            )
        )
        .scalars()
        .all()
    )

    structure = work.structure
    return {
        "work": {
            "title": work.title,
            "series": work.series.name if work.series else None,
            "status": work.status,
            "summary": work.summary,
            "planned_chapter_count": work.planned_chapter_count,
            "actual_chapter_count": work.actual_chapter_count,
            "total_word_count": work.total_word_count,
            "created_at": work.created_at,
            "updated_at": work.updated_at,
        },
        "structure": {
            "name": structure.name if structure else None,
            "stages": json.loads(structure.stages) if structure else [],
            "description": structure.description if structure else None,
        },
        "stages": [
            {"name": stage.name, "overview": stage.overview, "sort_order": stage.sort_order}
            for stage in stages
        ],
        "chapters": [
            {
                "chapter_number": chapter.chapter_number,
                "title": chapter.title,
                "summary": chapter.summary,
                "content": chapter.content,
                "status": chapter.status,
                "word_count": chapter.word_count,
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
        ],
        "worldbuilding": [
            {
                "category": category.name,
                "entries": [
                    {
                        "name": entity.name,
                        "description": entity.description,
                        "properties": json.loads(entity.properties or "[]"),
                    }
                    for entity in entities
                    if entity.category_id == category.id
                ],
            }
            for category in categories
        ],
    }


async def build_work_export_markdown(db: AsyncSession, work_id: int) -> str | None:
    """Build the Markdown manuscript (title, summary, chapters) or None if missing."""
    work = await _load_work(db, work_id)
    if work is None:
        return None
    chapters = await load_chapters_with_scenes(db, work_id)

    lines = [f"# {work.title}", ""]
    if work.summary and work.summary.strip():
        lines.append(f"> {work.summary.strip()}")
        lines.append("")
    for chapter in chapters:
        heading = f"第{chapter.chapter_number}章"
        if chapter.title:
            heading += f" {chapter.title}"
        lines.append(f"## {heading}")
        lines.append("")
        body = (chapter.content or "").strip()
        lines.append(body if body else "（本章暂无正文）")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
