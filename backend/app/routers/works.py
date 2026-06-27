"""CRUD routes for works (novel projects).

Phase 0 provides a basic vertical slice: list, create (which seeds the four
default worldbuilding categories), and delete. The full works page behaviour
(sorting, pagination, search, detail editing) is implemented in Phase 1.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Series, StoryStructure, Work
from app.schemas import WorkCreate, WorkRead
from app.services.seed import seed_default_categories

router = APIRouter(prefix="/works", tags=["works"])


@router.get("", response_model=list[WorkRead])
async def list_works(db: AsyncSession = Depends(get_db)) -> list[Work]:
    """List works ordered by most recently updated."""
    result = await db.execute(select(Work).order_by(Work.updated_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=WorkRead, status_code=status.HTTP_201_CREATED)
async def create_work(payload: WorkCreate, db: AsyncSession = Depends(get_db)) -> Work:
    """Create a work and seed its four default worldbuilding categories."""
    if payload.series_id is not None and await db.get(Series, payload.series_id) is None:
        raise HTTPException(status_code=404, detail="Series not found")
    if payload.structure_id is not None:
        if await db.get(StoryStructure, payload.structure_id) is None:
            raise HTTPException(status_code=404, detail="Story structure not found")

    work = Work(
        title=payload.title,
        series_id=payload.series_id,
        structure_id=payload.structure_id,
        planned_chapter_count=payload.planned_chapter_count,
        summary=payload.summary,
    )
    db.add(work)
    await db.flush()

    await seed_default_categories(db, work.id)
    await db.commit()
    await db.refresh(work)
    return work


@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work(work_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a work; related rows are removed via ON DELETE CASCADE."""
    work = await db.get(Work, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")

    await db.delete(work)
    await db.commit()
