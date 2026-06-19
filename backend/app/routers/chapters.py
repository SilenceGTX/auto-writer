"""CRUD API routes for chapter management."""

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Chapter

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("/")
async def list_chapters(
    story_id: int = Query(..., description="Filter by story ID"),
    db: AsyncSession = Depends(get_db),
):
    """List chapters for a story, ordered by position."""
    result = await db.execute(
        select(Chapter)
        .where(Chapter.story_id == story_id)
        .order_by(Chapter.order)
    )
    return result.scalars().all()


@router.post("/")
async def create_chapter(
    story_id: int,
    title: str,
    db: AsyncSession = Depends(get_db),
):
    """Create a new chapter in a story."""
    # Determine next order value
    result = await db.execute(
        select(Chapter)
        .where(Chapter.story_id == story_id)
        .order_by(Chapter.order.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_order = (last.order + 1) if last else 1

    chapter = Chapter(story_id=story_id, title=title, order=next_order)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.get("/{chapter_id}")
async def get_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single chapter by ID."""
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.patch("/{chapter_id}")
async def update_chapter(
    chapter_id: int,
    title: str | None = Body(None),
    content: str | None = Body(None),
    summary: str | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Update chapter fields."""
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if title is not None:
        chapter.title = title
    if content is not None:
        chapter.content = content
    if summary is not None:
        chapter.summary = summary
    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chapter and its scenes."""
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    await db.delete(chapter)
    await db.commit()
    return {"ok": True}
