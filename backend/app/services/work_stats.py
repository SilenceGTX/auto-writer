"""Aggregated chapter counts for work progress display."""

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter


def _chapter_has_body() -> object:
    """SQL expression: chapter body text is present (non-empty after trim)."""
    trimmed = func.trim(Chapter.content, " \t\n\r\v\f")
    return and_(Chapter.content.isnot(None), func.length(trimmed) > 0)


async def chapter_progress_counts(
    db: AsyncSession, work_ids: list[int]
) -> dict[int, tuple[int, int]]:
    """Return ``{work_id: (written_count, chapter_count)}`` for the given works.

    *written_count* counts chapters with non-empty body text (by ``content``, not
    the cached ``word_count`` column, so progress stays correct even if counts
    were not recomputed).
    *chapter_count* is the total number of chapters on the work.
    """
    if not work_ids:
        return {}

    written_expr = func.sum(case((_chapter_has_body(), 1), else_=0))
    result = await db.execute(
        select(Chapter.work_id, func.count(), written_expr)
        .where(Chapter.work_id.in_(work_ids))
        .group_by(Chapter.work_id)
    )
    return {row[0]: (int(row[2] or 0), int(row[1])) for row in result.all()}
