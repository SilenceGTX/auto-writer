"""Worldbuilding (设定) page backend: categories and entries.

Implements ``designs/CONCEPT_PAGE_DESIGN.md`` and ``DATA_STORAGE_DESIGN.md``
§4.7/§4.8: per-work entity categories (preset + custom), worldbuilding entries
with free-form JSON key-value properties (list with search / sort / pagination),
and a property-name candidate set per category (powering the reuse / template
feature). Deleting a custom category cascades to its entries.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EntityCategory, Work, WorldEntity
from app.schemas import (
    EntityCategoryCreate,
    EntityCategoryRead,
    WorldEntityCreate,
    WorldEntityListResponse,
    WorldEntityRead,
    WorldEntityUpdate,
)

router = APIRouter(tags=["worldbuilding"])

SORT_COLUMNS = {
    "name": WorldEntity.name,
    "created_at": WorldEntity.created_at,
}


async def _get_work(db: AsyncSession, work_id: int) -> Work:
    """Load a work by id or raise 404."""
    work = await db.get(Work, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")
    return work


async def _get_category(db: AsyncSession, category_id: int) -> EntityCategory:
    """Load an entity category by id or raise 404."""
    category = await db.get(EntityCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


async def _get_entity(db: AsyncSession, entity_id: int) -> WorldEntity:
    """Load a worldbuilding entry by id or raise 404."""
    entity = await db.get(WorldEntity, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


def _serialize_properties(properties: list) -> str:
    """Serialize a list of property models into a JSON text column value."""
    return json.dumps([prop.model_dump() for prop in properties], ensure_ascii=False)


@router.get("/works/{work_id}/categories", response_model=list[EntityCategoryRead])
async def list_categories(
    work_id: int, db: AsyncSession = Depends(get_db)
) -> list[EntityCategoryRead]:
    """List a work's worldbuilding categories with their entry counts."""
    await _get_work(db, work_id)
    result = await db.execute(
        select(EntityCategory, func.count(WorldEntity.id))
        .outerjoin(WorldEntity, WorldEntity.category_id == EntityCategory.id)
        .where(EntityCategory.work_id == work_id)
        .group_by(EntityCategory.id)
        .order_by(EntityCategory.sort_order, EntityCategory.id)
    )
    return [
        EntityCategoryRead(
            id=category.id,
            work_id=category.work_id,
            name=category.name,
            is_preset=category.is_preset,
            sort_order=category.sort_order,
            entity_count=int(count or 0),
        )
        for category, count in result.all()
    ]


@router.post(
    "/works/{work_id}/categories",
    response_model=EntityCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    work_id: int, payload: EntityCategoryCreate, db: AsyncSession = Depends(get_db)
) -> EntityCategoryRead:
    """Create a custom category for a work, rejecting duplicate names."""
    await _get_work(db, work_id)
    name = payload.name.strip()
    existing = await db.scalar(
        select(EntityCategory.id).where(
            EntityCategory.work_id == work_id, EntityCategory.name == name
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="该种类名称已存在")

    max_order = await db.scalar(
        select(func.max(EntityCategory.sort_order)).where(EntityCategory.work_id == work_id)
    )
    category = EntityCategory(
        work_id=work_id, name=name, is_preset=0, sort_order=int(max_order or 0) + 1
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    logger.info("新增设定种类 work_id={} name={}", work_id, name)
    return EntityCategoryRead(
        id=category.id,
        work_id=category.work_id,
        name=category.name,
        is_preset=category.is_preset,
        sort_order=category.sort_order,
        entity_count=0,
    )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a custom category and its entries; preset categories are protected."""
    category = await _get_category(db, category_id)
    if category.is_preset:
        raise HTTPException(status_code=409, detail="预设种类不可删除")
    await db.delete(category)
    await db.commit()
    logger.info("删除设定种类 category_id={}（级联其条目）", category_id)


@router.get("/categories/{category_id}/property-names", response_model=list[str])
async def list_property_names(
    category_id: int, db: AsyncSession = Depends(get_db)
) -> list[str]:
    """Return distinct property names used in a category, most frequent first.

    Powers the "属性名称复用 / 属性模板" feature: the candidate set is derived
    from the existing entries' property names without a dedicated table.
    """
    await _get_category(db, category_id)
    result = await db.execute(
        select(WorldEntity.properties).where(WorldEntity.category_id == category_id)
    )
    counts: dict[str, int] = {}
    for (raw,) in result.all():
        for prop in json.loads(raw or "[]"):
            name = str(prop.get("name", "")).strip()
            if name:
                counts[name] = counts.get(name, 0) + 1
    return sorted(counts, key=lambda name: (-counts[name], name))


@router.get("/works/{work_id}/entities", response_model=WorldEntityListResponse)
async def list_entities(
    work_id: int,
    db: AsyncSession = Depends(get_db),
    category_id: int | None = Query(default=None),
    search: str = Query(default=""),
    sort_by: str = Query(default="sort_order"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
) -> WorldEntityListResponse:
    """List a work's entries with optional category filter, search, and paging."""
    await _get_work(db, work_id)
    base = select(WorldEntity).where(WorldEntity.work_id == work_id)
    if category_id is not None:
        base = base.where(WorldEntity.category_id == category_id)
    if search.strip():
        like = f"%{search.strip()}%"
        base = base.where(or_(WorldEntity.name.like(like), WorldEntity.description.like(like)))

    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0

    column = SORT_COLUMNS.get(sort_by, WorldEntity.sort_order)
    ordering = column.asc() if order == "asc" else column.desc()
    stmt = (
        base.order_by(ordering, WorldEntity.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = [WorldEntityRead.model_validate(entity) for entity in result.scalars().all()]
    return WorldEntityListResponse(items=items, total=total)


@router.post(
    "/works/{work_id}/entities",
    response_model=WorldEntityRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_entity(
    work_id: int, payload: WorldEntityCreate, db: AsyncSession = Depends(get_db)
) -> WorldEntityRead:
    """Create a worldbuilding entry under one of the work's categories."""
    await _get_work(db, work_id)
    category = await _get_category(db, payload.category_id)
    if category.work_id != work_id:
        raise HTTPException(status_code=400, detail="种类不属于该作品")

    max_order = await db.scalar(
        select(func.max(WorldEntity.sort_order)).where(
            WorldEntity.category_id == payload.category_id
        )
    )
    entity = WorldEntity(
        work_id=work_id,
        category_id=payload.category_id,
        name=payload.name.strip(),
        description=payload.description,
        properties=_serialize_properties(payload.properties),
        sort_order=int(max_order or 0) + 1,
    )
    db.add(entity)
    await db.commit()
    await db.refresh(entity)
    return WorldEntityRead.model_validate(entity)


@router.patch("/entities/{entity_id}", response_model=WorldEntityRead)
async def update_entity(
    entity_id: int, payload: WorldEntityUpdate, db: AsyncSession = Depends(get_db)
) -> WorldEntityRead:
    """Partially update an entry (name, description, category, properties)."""
    entity = await _get_entity(db, entity_id)
    data = payload.model_dump(exclude_unset=True)

    if "category_id" in data and data["category_id"] != entity.category_id:
        category = await _get_category(db, data["category_id"])
        if category.work_id != entity.work_id:
            raise HTTPException(status_code=400, detail="种类不属于该作品")

    if "properties" in data:
        entity.properties = _serialize_properties(payload.properties or [])
        data.pop("properties")
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()

    for field, value in data.items():
        setattr(entity, field, value)

    await db.commit()
    await db.refresh(entity)
    return WorldEntityRead.model_validate(entity)


@router.delete("/entities/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(entity_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a worldbuilding entry by id."""
    entity = await _get_entity(db, entity_id)
    await db.delete(entity)
    await db.commit()
