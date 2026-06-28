"""Inspiration capture backend: the global "加入灵感" clipboard.

Implements ``GENERAL_UI_DESIGN.md`` G3 and ``DATA_STORAGE_DESIGN.md`` §4.9: any
page can save a selected snippet as an inspiration, recording its source page,
work, and chapter so the inspiration page (Phase 7) can support source jumping.
This module provides create / list / delete; tag management is deferred to the
inspiration page phase.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Inspiration
from app.schemas import InspirationCreate, InspirationRead

router = APIRouter(tags=["inspirations"])


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
    await db.refresh(inspiration)
    logger.info("加入灵感 id={} source={}", inspiration.id, payload.source_page)
    return InspirationRead.model_validate(inspiration)


@router.get("/inspirations", response_model=list[InspirationRead])
async def list_inspirations(
    db: AsyncSession = Depends(get_db),
    search: str = Query(default=""),
    source_page: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[InspirationRead]:
    """List inspirations (newest first) with optional search and source filter."""
    stmt = select(Inspiration)
    if search.strip():
        stmt = stmt.where(Inspiration.content.like(f"%{search.strip()}%"))
    if source_page:
        stmt = stmt.where(Inspiration.source_page == source_page)
    stmt = stmt.order_by(Inspiration.created_at.desc(), Inspiration.id.desc()).limit(limit)
    result = await db.execute(stmt)
    return [InspirationRead.model_validate(item) for item in result.scalars().all()]


@router.delete("/inspirations/{inspiration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inspiration(inspiration_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete an inspiration by id."""
    inspiration = await db.get(Inspiration, inspiration_id)
    if inspiration is None:
        raise HTTPException(status_code=404, detail="Inspiration not found")
    await db.delete(inspiration)
    await db.commit()
