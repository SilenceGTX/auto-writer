"""CRUD API routes for scene management with drag-reorder support."""

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Scene
from app.services.yaml_export import export_chapter_yaml, export_scene_yaml, get_default_export_dir

router = APIRouter(prefix="/scenes", tags=["scenes"])


class ReorderPayload(BaseModel):
    """Payload for reordering scenes: chapter_id and list of scene IDs in new order."""

    chapter_id: int
    ids: list[int]


@router.get("/")
async def list_scenes(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List scenes for a chapter, ordered by position."""
    result = await db.execute(
        select(Scene)
        .where(Scene.chapter_id == chapter_id)
        .order_by(Scene.order)
    )
    return result.scalars().all()


@router.post("/")
async def create_scene(
    chapter_id: int,
    title: str,
    db: AsyncSession = Depends(get_db),
):
    """Create a new scene in a chapter."""
    result = await db.execute(
        select(Scene)
        .where(Scene.chapter_id == chapter_id)
        .order_by(Scene.order.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_order = (last.order + 1) if last else 1

    scene = Scene(chapter_id=chapter_id, title=title, order=next_order)
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


@router.get("/{scene_id}")
async def get_scene(scene_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single scene by ID."""
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.patch("/{scene_id}")
async def update_scene(
    scene_id: int,
    title: str | None = Body(None),
    description: str | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Update scene title or description."""
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if title is not None:
        scene.title = title
    if description is not None:
        scene.description = description
    await db.commit()
    await db.refresh(scene)
    return scene


@router.put("/reorder")
async def reorder_scenes(
    payload: ReorderPayload,
    db: AsyncSession = Depends(get_db),
):
    """Reassign order values for scenes in a chapter based on ID list order."""
    for idx, scene_id in enumerate(payload.ids, start=1):
        await db.execute(
            update(Scene)
            .where(Scene.id == scene_id, Scene.chapter_id == payload.chapter_id)
            .values(order=idx)
        )
    await db.commit()
    return {"ok": True}


@router.delete("/{scene_id}")
async def delete_scene(scene_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a scene and its plot items."""
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    await db.delete(scene)
    await db.commit()
    return {"ok": True}


@router.post("/{scene_id}/export")
async def export_scene(scene_id: int, db: AsyncSession = Depends(get_db)):
    """Export a single scene and its plot items as a YAML file."""
    try:
        path = await export_scene_yaml(scene_id, get_default_export_dir(), db)
        return {"ok": True, "path": path}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/export-chapter/{chapter_id}")
async def export_chapter_scenes(chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Export all scenes under a chapter as YAML files."""
    try:
        paths = await export_chapter_yaml(chapter_id, get_default_export_dir(), db)
        return {"ok": True, "paths": paths}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
