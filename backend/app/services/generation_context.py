"""Shared LLM generation context helpers for the outline and writing flows.

Centralizes the two pieces both generation routers need: resolving the LLM
connection / system prompt / sampling params from the saved settings, and
building the 【作品信息】 prompt block for a work. Keeping these here avoids
duplicating the logic across the outline and writing routers.
"""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Work
from app.services.llm_service import LLMConnection
from app.services.prompts import build_system_prompt, build_work_info_block
from app.services.settings_service import get_all_settings


async def load_work_with_structure(db: AsyncSession, work_id: int) -> Work | None:
    """Load a work with its structure relationship eagerly loaded, or None."""
    result = await db.execute(
        select(Work).options(selectinload(Work.structure)).where(Work.id == work_id)
    )
    return result.scalar_one_or_none()


async def resolve_llm_context(
    db: AsyncSession, stage: str
) -> tuple[LLMConnection, str, dict]:
    """Resolve the connection, system prompt, and sampling params for a stage.

    ``stage`` selects the preference group (``"outline"`` or ``"writing"``).
    """
    settings = await get_all_settings(db)
    connection = LLMConnection.from_settings(settings["connection"])
    system_prompt = build_system_prompt(settings["writing_style"].get("text", ""))
    params = settings["preferences"][stage]
    return connection, system_prompt, params


def work_info_block(work: Work) -> str:
    """Build the 【作品信息】 prompt block for a work (with its structure)."""
    structure = work.structure
    stages = json.loads(structure.stages) if structure else []
    return build_work_info_block(
        title=work.title,
        structure_name=structure.name if structure else None,
        stages=stages,
        structure_description=structure.description if structure else None,
        planned_chapter_count=work.planned_chapter_count,
        actual_chapter_count=work.actual_chapter_count,
        summary=work.summary,
    )
