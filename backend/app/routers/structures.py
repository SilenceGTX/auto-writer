"""Read routes for story structures (presets and user-defined)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import StoryStructure
from app.schemas import StoryStructureRead

router = APIRouter(prefix="/structures", tags=["structures"])


@router.get("", response_model=list[StoryStructureRead])
async def list_structures(db: AsyncSession = Depends(get_db)) -> list[StoryStructure]:
    """List all story structures, presets first then user-defined by id."""
    result = await db.execute(
        select(StoryStructure).order_by(StoryStructure.is_preset.desc(), StoryStructure.id)
    )
    return list(result.scalars().all())
