"""CRUD routes for series management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Series
from app.schemas import SeriesCreate, SeriesRead

router = APIRouter(prefix="/series", tags=["series"])


@router.get("", response_model=list[SeriesRead])
async def list_series(db: AsyncSession = Depends(get_db)) -> list[Series]:
    """List all series ordered by creation time (newest first)."""
    result = await db.execute(select(Series).order_by(Series.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=SeriesRead, status_code=status.HTTP_201_CREATED)
async def create_series(payload: SeriesCreate, db: AsyncSession = Depends(get_db)) -> Series:
    """Create a new series, rejecting duplicate names."""
    existing = await db.execute(select(Series).where(Series.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Series already exists")

    series = Series(name=payload.name)
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return series


@router.delete("/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_series(series_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a series; member works keep their data with series_id set to NULL."""
    series = await db.get(Series, series_id)
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")

    await db.delete(series)
    await db.commit()
