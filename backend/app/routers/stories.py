"""CRUD routes for story project management."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Series, Story
from app.schemas import StoryCreate, StoryRead

router = APIRouter(prefix="/stories", tags=["stories"])


@router.get("", response_model=list[StoryRead])
async def list_stories(
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[Story]:
    """List stories, optionally filtered by title search text."""
    statement = select(Story).options(selectinload(Story.series)).order_by(Story.updated_at.desc())
    if search:
        statement = statement.where(Story.title.contains(search))

    result = await db.execute(statement)
    return list(result.scalars().all())


@router.post("", response_model=StoryRead, status_code=status.HTTP_201_CREATED)
async def create_story(payload: StoryCreate, db: AsyncSession = Depends(get_db)) -> Story:
    """Create a new story project."""
    if payload.series_id is not None:
        series = await db.get(Series, payload.series_id)
        if series is None:
            raise HTTPException(status_code=404, detail="Series not found")

    story = Story(
        title=payload.title,
        description=payload.description,
        structure=payload.structure,
        chapter_goal=payload.chapter_goal,
        series_id=payload.series_id,
    )
    db.add(story)
    await db.commit()

    result = await db.execute(
        select(Story).options(selectinload(Story.series)).where(Story.id == story.id)
    )
    return result.scalar_one()


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(story_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a story by ID."""
    story = await db.get(Story, story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")

    await db.delete(story)
    await db.commit()
