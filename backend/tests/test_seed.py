"""Tests for preset seed data (story structures)."""

import json

from sqlalchemy import select

from app.models import StoryStructure
from app.services.seed import PRESET_STORY_STRUCTURES, seed_story_structures


async def test_presets_seeded(session):
    """All preset story structures are present and marked as presets."""
    result = await session.execute(select(StoryStructure))
    structures = result.scalars().all()

    assert len(structures) == len(PRESET_STORY_STRUCTURES)
    names = {item.name for item in structures}
    assert {"无", "三幕式", "起承转合", "英雄之旅", "斯奈德节拍表"} == names
    assert all(item.is_preset == 1 for item in structures)


async def test_three_act_stages(session):
    """The three-act structure stores its stages as a JSON array."""
    result = await session.execute(select(StoryStructure).where(StoryStructure.name == "三幕式"))
    three_act = result.scalar_one()
    assert json.loads(three_act.stages) == ["铺垫", "对抗", "解决"]


async def test_seed_is_idempotent(session):
    """Running the seeder again does not create duplicate presets."""
    await seed_story_structures(session)
    await session.commit()

    result = await session.execute(select(StoryStructure))
    assert len(result.scalars().all()) == len(PRESET_STORY_STRUCTURES)
