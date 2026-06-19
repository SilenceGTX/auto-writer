"""CRUD API routes for plot item management within scenes."""

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import PLOT_ITEM_TYPES, PlotItem

router = APIRouter(prefix="/plot-items", tags=["plot_items"])


class ReorderPayload(BaseModel):
    """Payload for reordering plot items: scene_id and list of item IDs in new order."""

    scene_id: int
    ids: list[int]


@router.get("/")
async def list_items(
    scene_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List plot items for a scene, ordered by position."""
    result = await db.execute(
        select(PlotItem)
        .where(PlotItem.scene_id == scene_id)
        .order_by(PlotItem.order)
    )
    return result.scalars().all()


@router.get("/types")
async def list_item_types():
    """Return the valid plot item type choices."""
    return PLOT_ITEM_TYPES


@router.post("/")
async def create_item(
    scene_id: int,
    item_type: str = "推进",
    description: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Create a new plot item in a scene."""
    if item_type not in PLOT_ITEM_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid item type. Must be one of: {', '.join(PLOT_ITEM_TYPES)}",
        )

    result = await db.execute(
        select(PlotItem)
        .where(PlotItem.scene_id == scene_id)
        .order_by(PlotItem.order.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_order = (last.order + 1) if last else 1

    item = PlotItem(scene_id=scene_id, item_type=item_type, description=description, order=next_order)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{item_id}")
async def update_item(
    item_id: int,
    item_type: str | None = Body(None),
    description: str | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Update a plot item's type or description."""
    result = await db.execute(select(PlotItem).where(PlotItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Plot item not found")

    if item_type is not None:
        if item_type not in PLOT_ITEM_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid item type. Must be one of: {', '.join(PLOT_ITEM_TYPES)}",
            )
        item.item_type = item_type
    if description is not None:
        item.description = description

    await db.commit()
    await db.refresh(item)
    return item


@router.put("/reorder")
async def reorder_items(
    payload: ReorderPayload,
    db: AsyncSession = Depends(get_db),
):
    """Reassign order values for plot items in a scene based on ID list order."""
    for idx, item_id in enumerate(payload.ids, start=1):
        await db.execute(
            update(PlotItem)
            .where(PlotItem.id == item_id, PlotItem.scene_id == payload.scene_id)
            .values(order=idx)
        )
    await db.commit()
    return {"ok": True}


@router.delete("/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a plot item."""
    result = await db.execute(select(PlotItem).where(PlotItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Plot item not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}
