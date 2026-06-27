"""Seed data helpers for presets and per-work defaults.

Provides idempotent seeding of the preset story structures (run at startup) and
a helper to seed the four default worldbuilding categories whenever a new work
is created, as specified in ``designs/DATA_STORAGE_DESIGN.md`` sections 7.1/7.2.
"""

import json

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EntityCategory, StoryStructure

PRESET_STORY_STRUCTURES: list[dict[str, object]] = [
    {"name": "无", "stages": [], "description": "完全自由的创作，无固定结构约束。"},
    {
        "name": "三幕式",
        "stages": ["铺垫", "对抗", "解决"],
        "description": "最通用的故事骨架。新手首选，稳妥清晰。",
    },
    {
        "name": "起承转合",
        "stages": ["开端", "发展", "转折", "结尾"],
        "description": "东方叙事的经典节奏，注重意境与留白。",
    },
    {
        "name": "英雄之旅",
        "stages": [
            "平凡世界",
            "冒险的召唤",
            "拒绝召唤",
            "遇见导师",
            "跨越第一道门槛",
            "考验、盟友与敌人",
            "接近深洞穴",
            "严峻考验",
            "获得奖赏",
            "返回之路",
            "复活与蜕变",
            "带着灵药归来",
        ],
        "description": "“平凡人成为英雄”的标准模板，适合奇幻、科幻与成长冒险。",
    },
    {
        "name": "斯奈德节拍表",
        "stages": [
            "开场画面",
            "主题陈述",
            "建立",
            "催化剂",
            "内心挣扎",
            "进入第二幕",
            "B 故事",
            "趣味与游戏",
            "中点",
            "坏蛋逼近",
            "一败涂地",
            "灵魂的黑夜",
            "进入第三幕",
            "结局",
            "终场画面",
        ],
        "description": "节奏感极强的商业写作指南，适合快节奏、强情节故事。",
    },
]

DEFAULT_ENTITY_CATEGORIES: list[str] = ["人物", "地点", "物品", "概念"]


async def seed_story_structures(session: AsyncSession) -> None:
    """Insert preset story structures if they are not already present.

    Idempotent: only missing preset names (by ``is_preset = 1``) are inserted,
    so this is safe to call on every startup.
    """
    result = await session.execute(select(StoryStructure.name).where(StoryStructure.is_preset == 1))
    existing = {row[0] for row in result.all()}

    for preset in PRESET_STORY_STRUCTURES:
        if preset["name"] in existing:
            continue
        session.add(
            StoryStructure(
                name=str(preset["name"]),
                stages=json.dumps(preset["stages"], ensure_ascii=False),
                description=str(preset["description"]),
                is_preset=1,
            )
        )


async def seed_default_categories(session: AsyncSession, work_id: int) -> None:
    """Seed the four preset worldbuilding categories for a newly created work."""
    for index, name in enumerate(DEFAULT_ENTITY_CATEGORIES):
        session.add(EntityCategory(work_id=work_id, name=name, is_preset=1, sort_order=index))


async def count_story_structures(session: AsyncSession) -> int:
    """Return the total number of story structures (helper for tests/diagnostics)."""
    result = await session.execute(select(func.count()).select_from(StoryStructure))
    return int(result.scalar_one())
