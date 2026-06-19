"""CRUD API routes for world-building entities (characters, locations, items, orgs, etc.)."""

import json

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DEFAULT_ENTITY_TYPES, ENTITY_TYPE_LABELS, WorldEntity

router = APIRouter(prefix="/world-entities", tags=["world_entities"])


@router.get("/types")
async def list_entity_types(
    story_id: int = Query(..., description="Story ID"),
    db: AsyncSession = Depends(get_db),
):
    """Return entity types used in this story, with defaults always included."""
    result = await db.execute(
        select(WorldEntity.entity_type, func.count(WorldEntity.id))
        .where(WorldEntity.story_id == story_id)
        .group_by(WorldEntity.entity_type)
    )
    counts = {row[0]: row[1] for row in result.all()}

    types = []
    seen = set()
    for code in DEFAULT_ENTITY_TYPES:
        seen.add(code)
        types.append({"code": code, "label": ENTITY_TYPE_LABELS.get(code, code), "count": counts.get(code, 0)})
    for code in counts:
        if code not in seen:
            types.append({"code": code, "label": code, "count": counts[code]})

    return types


@router.get("/")
async def list_entities(
    story_id: int = Query(...),
    entity_type: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List world entities for a story, optionally filtered by type and search."""
    stmt = select(WorldEntity).where(WorldEntity.story_id == story_id).order_by(WorldEntity.name)
    if entity_type:
        stmt = stmt.where(WorldEntity.entity_type == entity_type)
    if search:
        stmt = stmt.where(WorldEntity.name.contains(search))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/")
async def create_entity(
    story_id: int = Body(...),
    entity_type: str = Body(...),
    name: str = Body(...),
    properties: str = Body("{}"),
    db: AsyncSession = Depends(get_db),
):
    """Create a new world entity."""
    try:
        json.loads(properties)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="properties must be valid JSON")

    entity = WorldEntity(
        story_id=story_id,
        entity_type=entity_type.lower(),
        name=name.strip(),
        properties=properties,
    )
    db.add(entity)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.patch("/{entity_id}")
async def update_entity(
    entity_id: int,
    name: str | None = Body(None),
    properties: str | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Update a world entity's name or properties."""
    result = await db.execute(select(WorldEntity).where(WorldEntity.id == entity_id))
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if name is not None:
        entity.name = name.strip()
    if properties is not None:
        try:
            json.loads(properties)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="properties must be valid JSON")
        entity.properties = properties

    await db.commit()
    await db.refresh(entity)
    return entity


@router.delete("/{entity_id}")
async def delete_entity(entity_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a world entity."""
    result = await db.execute(select(WorldEntity).where(WorldEntity.id == entity_id))
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    await db.delete(entity)
    await db.commit()
    return {"ok": True}
