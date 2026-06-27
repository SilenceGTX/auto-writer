"""CRUD routes for works (novel projects).

Implements the works page backend (``designs/STORY_PAGE_DESIGN.md``): list with
search / sort / pagination, create (seeding the four default worldbuilding
categories), partial update, and delete. Each serialized work includes its
series and structure display names for the list and detail views.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Series, StoryStructure, Work
from app.schemas import WorkCreate, WorkListResponse, WorkRead, WorkUpdate
from app.services.seed import seed_default_categories

router = APIRouter(prefix="/works", tags=["works"])

SORT_COLUMNS = {
    "updated_at": Work.updated_at,
    "created_at": Work.created_at,
    "title": Work.title,
    "word_count": Work.total_word_count,
    "status": Work.status,
}


def _to_read(work: Work) -> WorkRead:
    """Build a WorkRead, resolving series/structure display names."""
    return WorkRead(
        id=work.id,
        title=work.title,
        series_id=work.series_id,
        structure_id=work.structure_id,
        series_name=work.series.name if work.series else None,
        structure_name=work.structure.name if work.structure else None,
        planned_chapter_count=work.planned_chapter_count,
        actual_chapter_count=work.actual_chapter_count,
        current_chapter=work.current_chapter,
        total_word_count=work.total_word_count,
        status=work.status,
        summary=work.summary,
        created_at=work.created_at,
        updated_at=work.updated_at,
    )


async def _load_work_read(db: AsyncSession, work_id: int) -> WorkRead:
    """Reload a work with its relationships and serialize it for the API."""
    result = await db.execute(
        select(Work)
        .options(selectinload(Work.series), selectinload(Work.structure))
        .where(Work.id == work_id)
    )
    return _to_read(result.scalar_one())


async def _validate_references(
    db: AsyncSession, series_id: int | None, structure_id: int | None
) -> None:
    """Ensure referenced series / structure ids exist when provided."""
    if series_id is not None and await db.get(Series, series_id) is None:
        raise HTTPException(status_code=404, detail="Series not found")
    if structure_id is not None and await db.get(StoryStructure, structure_id) is None:
        raise HTTPException(status_code=404, detail="Story structure not found")


@router.get("", response_model=WorkListResponse)
async def list_works(
    db: AsyncSession = Depends(get_db),
    search: str = Query(default="", description="Match against work or series name"),
    sort_by: str = Query(default="updated_at"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
) -> WorkListResponse:
    """List works with search, sorting, and pagination (default 10 per page)."""
    base = select(Work).outerjoin(Series, Work.series_id == Series.id)
    if search.strip():
        like = f"%{search.strip()}%"
        base = base.where(or_(Work.title.like(like), Series.name.like(like)))

    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0

    column = SORT_COLUMNS.get(sort_by, Work.updated_at)
    ordering = column.asc() if order == "asc" else column.desc()
    stmt = (
        base.options(selectinload(Work.series), selectinload(Work.structure))
        .order_by(ordering, Work.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = [_to_read(work) for work in result.scalars().all()]
    return WorkListResponse(items=items, total=total)


@router.post("", response_model=WorkRead, status_code=status.HTTP_201_CREATED)
async def create_work(payload: WorkCreate, db: AsyncSession = Depends(get_db)) -> WorkRead:
    """Create a work and seed its four default worldbuilding categories."""
    await _validate_references(db, payload.series_id, payload.structure_id)

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
    return await _load_work_read(db, work.id)


@router.patch("/{work_id}", response_model=WorkRead)
async def update_work(
    work_id: int, payload: WorkUpdate, db: AsyncSession = Depends(get_db)
) -> WorkRead:
    """Partially update a work; only the fields present in the body are applied."""
    work = await db.get(Work, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")

    data = payload.model_dump(exclude_unset=True)
    await _validate_references(db, data.get("series_id"), data.get("structure_id"))

    if (
        work.actual_chapter_count is not None
        and "planned_chapter_count" in data
        and data["planned_chapter_count"] != work.planned_chapter_count
    ):
        raise HTTPException(status_code=409, detail="大纲已锁定，无法修改预计章节数")

    for field, value in data.items():
        setattr(work, field, value)
    await db.commit()
    return await _load_work_read(db, work.id)


@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work(work_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a work; related rows are removed via ON DELETE CASCADE."""
    work = await db.get(Work, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")

    await db.delete(work)
    await db.commit()
