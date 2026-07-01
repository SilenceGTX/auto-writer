"""Tests for the prompt assembly helpers."""

from app.services.prompts import build_system_prompt, build_work_info_block


def test_system_prompt_without_style():
    """The base system prompt is returned when no style is provided."""
    prompt = build_system_prompt("")
    assert "小说创作助手" in prompt
    assert "写作风格要求" not in prompt


def test_system_prompt_injects_style():
    """A non-empty writing style is injected into the system prompt."""
    prompt = build_system_prompt("简洁冷峻，多用短句。")
    assert "写作风格要求" in prompt
    assert "简洁冷峻" in prompt


def test_work_info_block_contains_fields():
    """The work info block renders the supplied fields and stage list."""
    block = build_work_info_block(
        title="斩龙记",
        structure_name="三幕式",
        stages=["铺垫", "对抗", "解决"],
        structure_description="经典骨架",
        planned_chapter_count=20,
        summary="少年屠龙的故事",
    )
    assert "斩龙记" in block
    assert "三幕式" in block
    assert "铺垫、对抗、解决" in block
    assert "少年屠龙的故事" in block
