"""Tests for work chapter progress aggregation."""

from app.services.work_stats import chapter_progress_counts


async def test_chapter_progress_counts_written_and_total(session):
    """Written count includes only chapters with word_count > 0."""
    from app.models import Chapter, Work

    work = Work(title="进度测试")
    session.add(work)
    await session.flush()

    session.add_all(
        [
            Chapter(work_id=work.id, chapter_number=1, content="有正文", word_count=2),
            Chapter(work_id=work.id, chapter_number=2, content="", word_count=0),
            Chapter(work_id=work.id, chapter_number=3, content="也有", word_count=3),
        ]
    )
    await session.commit()

    counts = await chapter_progress_counts(session, [work.id])
    assert counts[work.id] == (2, 3)
