"""CRUD API routes for series management."""

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Series

router = APIRouter(prefix="/series", tags=["series"])


@router.get("/")
async def list_series(db: AsyncSession = Depends(get_db)):
    """List all series ordered by name."""
    result = await db.execute(select(Series).order_by(Series.name))
    return result.scalars().all()


@router.post("/")
async def create_series(name: str, description: str = "", db: AsyncSession = Depends(get_db)):
    """Create a new series."""
    series = Series(name=name, description=description)
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return series


@router.get("/{series_id}")
async def get_series(series_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single series by ID."""
    result = await db.execute(select(Series).where(Series.id == series_id))
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    return series


@router.patch("/{series_id}")
async def update_series(
    series_id: int,
    name: str | None = Body(None),
    description: str | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Update series name or description."""
    result = await db.execute(select(Series).where(Series.id == series_id))
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if name is not None:
        series.name = name
    if description is not None:
        series.description = description
    await db.commit()
    await db.refresh(series)
    return series


@router.delete("/{series_id}")
async def delete_series(series_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a series. Stories under it become unlinked (series_id = NULL)."""
    result = await db.execute(select(Series).where(Series.id == series_id))
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    await db.delete(series)
    await db.commit()
    return {"ok": True}
