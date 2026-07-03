"""Read/create routes for story structures (presets and user-defined)."""

import json

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import StoryStructure
from app.schemas import StoryStructureCreate, StoryStructureRead

router = APIRouter(prefix="/structures", tags=["structures"])


@router.get("", response_model=list[StoryStructureRead])
async def list_structures(db: AsyncSession = Depends(get_db)) -> list[StoryStructure]:
    """List all story structures, presets first then user-defined by id."""
    result = await db.execute(
        select(StoryStructure).order_by(StoryStructure.is_preset.desc(), StoryStructure.id)
    )
    return list(result.scalars().all())


@router.post("", response_model=StoryStructureRead, status_code=status.HTTP_201_CREATED)
async def create_structure(
    payload: StoryStructureCreate, db: AsyncSession = Depends(get_db)
) -> StoryStructure:
    """Create a user-defined story structure (selectable by any work)."""
    structure = StoryStructure(
        name=payload.name,
        stages=json.dumps(payload.stages, ensure_ascii=False),
        description=payload.description,
        is_preset=0,
    )
    db.add(structure)
    await db.commit()
    await db.refresh(structure)
    return structure
