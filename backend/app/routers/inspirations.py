"""Inspiration capture backend: the global "加入灵感" clipboard and its tags.

Implements ``GENERAL_UI_DESIGN.md`` G3, ``DATA_STORAGE_DESIGN.md`` §4.9–4.10 and
the inspiration page (``INSIGHTS_PAGE_DESIGN.md``): any page can save a selected
snippet as an inspiration, recording its source page / work / chapter so the
inspiration page can support source jumping. The inspiration page lists, filters
(by source / tag / fuzzy content) and classifies snippets with reusable colored
tags.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Inspiration, Tag
from app.schemas import (
    InspirationCreate,
    InspirationRead,
    InspirationTagsUpdate,
    TagCreate,
    TagRead,
)

router = APIRouter(tags=["inspirations"])


async def _get_inspiration_with_tags(db: AsyncSession, inspiration_id: int) -> Inspiration:
    """Load an inspiration with its tags eagerly, or raise 404."""
    result = await db.execute(
        select(Inspiration)
        .options(selectinload(Inspiration.tags))
        .where(Inspiration.id == inspiration_id)
    )
    inspiration = result.scalar_one_or_none()
    if inspiration is None:
        raise HTTPException(status_code=404, detail="Inspiration not found")
    return inspiration


@router.post("/inspirations", response_model=InspirationRead, status_code=status.HTTP_201_CREATED)
async def create_inspiration(
    payload: InspirationCreate, db: AsyncSession = Depends(get_db)
) -> InspirationRead:
    """Save a snippet as an inspiration with its optional source references."""
    inspiration = Inspiration(
        content=payload.content.strip(),
        source_page=payload.source_page,
        work_id=payload.work_id,
        chapter_id=payload.chapter_id,
    )
    db.add(inspiration)
    await db.commit()
    await db.refresh(inspiration, attribute_names=["tags"])
    logger.info("加入灵感 id={} source={}", inspiration.id, payload.source_page)
    return InspirationRead.model_validate(inspiration)


@router.get("/inspirations", response_model=list[InspirationRead])
async def list_inspirations(
    db: AsyncSession = Depends(get_db),
    search: str = Query(default=""),
    source_page: str | None = Query(default=None),
    tag_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[InspirationRead]:
    """List inspirations (newest first) with optional search, source, and tag filters."""
    stmt = select(Inspiration).options(selectinload(Inspiration.tags))
    if search.strip():
        stmt = stmt.where(Inspiration.content.like(f"%{search.strip()}%"))
    if source_page:
        stmt = stmt.where(Inspiration.source_page == source_page)
    if tag_id is not None:
        stmt = stmt.where(Inspiration.tags.any(Tag.id == tag_id))
    stmt = stmt.order_by(Inspiration.created_at.desc(), Inspiration.id.desc()).limit(limit)
    result = await db.execute(stmt)
    return [InspirationRead.model_validate(item) for item in result.scalars().all()]


@router.put("/inspirations/{inspiration_id}/tags", response_model=InspirationRead)
async def set_inspiration_tags(
    inspiration_id: int, payload: InspirationTagsUpdate, db: AsyncSession = Depends(get_db)
) -> InspirationRead:
    """Replace the full set of tags attached to an inspiration."""
    inspiration = await _get_inspiration_with_tags(db, inspiration_id)
    if payload.tag_ids:
        result = await db.execute(select(Tag).where(Tag.id.in_(payload.tag_ids)))
        inspiration.tags = list(result.scalars().all())
    else:
        inspiration.tags = []
    await db.commit()
    await db.refresh(inspiration, attribute_names=["tags"])
    return InspirationRead.model_validate(inspiration)


@router.delete("/inspirations/{inspiration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inspiration(inspiration_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete an inspiration by id."""
    inspiration = await db.get(Inspiration, inspiration_id)
    if inspiration is None:
        raise HTTPException(status_code=404, detail="Inspiration not found")
    await db.delete(inspiration)
    await db.commit()


@router.get("/tags", response_model=list[TagRead])
async def list_tags(db: AsyncSession = Depends(get_db)) -> list[TagRead]:
    """List all reusable tags (alphabetical by name)."""
    result = await db.execute(select(Tag).order_by(Tag.name))
    return [TagRead.model_validate(tag) for tag in result.scalars().all()]


@router.post("/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(payload: TagCreate, db: AsyncSession = Depends(get_db)) -> TagRead:
    """Create a tag, or return the existing one with the same name (idempotent)."""
    name = payload.name.strip()
    existing = (await db.execute(select(Tag).where(Tag.name == name))).scalar_one_or_none()
    if existing is not None:
        if payload.color and existing.color != payload.color:
            existing.color = payload.color
            await db.commit()
            await db.refresh(existing)
        return TagRead.model_validate(existing)
    tag = Tag(name=name, color=payload.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    logger.info("新建标签 id={} name={}", tag.id, tag.name)
    return TagRead.model_validate(tag)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a tag (removing it from all inspirations via cascade)."""
    tag = await db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()
