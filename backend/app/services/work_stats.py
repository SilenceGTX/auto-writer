"""Aggregated chapter counts for work progress display."""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter


async def chapter_progress_counts(
    db: AsyncSession, work_ids: list[int]
) -> dict[int, tuple[int, int]]:
    """Return ``{work_id: (written_count, chapter_count)}`` for the given works.

    *written_count* counts chapters with ``word_count > 0`` (body text present).
    *chapter_count* is the total number of chapters on the work.
    """
    if not work_ids:
        return {}

    written_expr = func.sum(case((Chapter.word_count > 0, 1), else_=0))
    result = await db.execute(
        select(Chapter.work_id, func.count(), written_expr)
        .where(Chapter.work_id.in_(work_ids))
        .group_by(Chapter.work_id)
    )
    return {row[0]: (int(row[2] or 0), int(row[1])) for row in result.all()}
