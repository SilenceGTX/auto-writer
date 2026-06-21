"""CRUD routes for story series management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Series
from app.schemas import SeriesCreate, SeriesRead

router = APIRouter(prefix="/series", tags=["series"])


@router.get("", response_model=list[SeriesRead])
async def list_series(db: AsyncSession = Depends(get_db)) -> list[Series]:
    """List all series ordered by creation time."""
    result = await db.execute(select(Series).order_by(Series.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=SeriesRead, status_code=status.HTTP_201_CREATED)
async def create_series(payload: SeriesCreate, db: AsyncSession = Depends(get_db)) -> Series:
    """Create a new story series."""
    existing = await db.execute(select(Series).where(Series.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Series already exists")

    series = Series(name=payload.name)
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return series
