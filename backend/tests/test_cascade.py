"""Tests for SQLite foreign-key enforcement and cascade behaviour."""

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Chapter, EntityCategory, Work, WorldEntity


async def test_foreign_keys_enforced(session):
    """Inserting a chapter referencing a missing work raises IntegrityError."""
    session.add(Chapter(work_id=999999, chapter_number=1, title="孤儿章节"))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_db_level_cascade_on_work_delete(session):
    """Deleting a work via raw SQL cascades to chapters and entities (PRAGMA on)."""
    work = Work(title="级联作品")
    session.add(work)
    await session.flush()

    category = EntityCategory(work_id=work.id, name="人物", is_preset=1)
    session.add(category)
    await session.flush()

    session.add(Chapter(work_id=work.id, chapter_number=1, title="第一章"))
    session.add(WorldEntity(work_id=work.id, category_id=category.id, name="张三", properties="[]"))
    await session.commit()

    # Raw delete bypasses ORM cascade, proving DB-level ON DELETE CASCADE works.
    await session.execute(text("DELETE FROM works WHERE id = :id"), {"id": work.id})
    await session.commit()

    chapters = await session.scalar(
        select(func.count()).select_from(Chapter).where(Chapter.work_id == work.id)
    )
    entities = await session.scalar(
        select(func.count()).select_from(WorldEntity).where(WorldEntity.work_id == work.id)
    )
    categories = await session.scalar(
        select(func.count()).select_from(EntityCategory).where(EntityCategory.work_id == work.id)
    )
    assert chapters == 0
    assert entities == 0
    assert categories == 0
