"""CRUD API routes for story management with series support and filtering."""

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Story

router = APIRouter(prefix="/stories", tags=["stories"])


@router.get("/")
async def list_stories(
    series_id: int | None = Query(None, description="Filter by series"),
    status: str | None = Query(None, description="Filter by status (连载/完结)"),
    search: str | None = Query(None, description="Search in title and series name"),
    db: AsyncSession = Depends(get_db),
):
    """List stories with optional filters, ordered by last update."""
    stmt = select(Story).options(joinedload(Story.series)).order_by(Story.updated_at.desc())
    if series_id is not None:
        stmt = stmt.where(Story.series_id == series_id)
    if status:
        stmt = stmt.where(Story.status == status)
    if search:
        stmt = stmt.where(Story.title.contains(search))
    result = await db.execute(stmt)
    return result.unique().scalars().all()


@router.post("/")
async def create_story(
    title: str,
    series_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a new story, optionally under a series."""
    story = Story(title=title, series_id=series_id)
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return story


@router.get("/{story_id}")
async def get_story(story_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single story by ID with series info."""
    result = await db.execute(
        select(Story).options(joinedload(Story.series)).where(Story.id == story_id)
    )
    story = result.unique().scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.patch("/{story_id}")
async def update_story(
    story_id: int,
    title: str | None = Body(None),
    series_id: int | None = Body(None),
    status: str | None = Body(None),
    description: str | None = Body(None),
    genre: str | None = Body(None),
    save_path: str | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Update story fields."""
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if title is not None:
        story.title = title
    if series_id is not None:
        story.series_id = series_id
    if status is not None:
        story.status = status
    if description is not None:
        story.description = description
    if genre is not None:
        story.genre = genre
    if save_path is not None:
        story.save_path = save_path
    await db.commit()
    await db.refresh(story)
    return story


@router.delete("/{story_id}")
async def delete_story(story_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a story and all its chapters and characters."""
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    await db.delete(story)
    await db.commit()
    return {"ok": True}
