"""Tests for the prompt assembly helpers."""

from unittest.mock import patch

from app.services.prompts import (
    assemble_draft_prompt,
    build_draft_requirements,
    build_system_prompt,
    build_work_info_block,
    log_assembled_prompt,
)
from app.services.references import ReferencedEntry, build_reference_block


@patch("app.services.prompts.logger.debug")
def test_builders_log_assembled_prompt_at_debug(mock_debug):
    """Each prompt builder emits a DEBUG log with the assembled text."""
    build_system_prompt("")
    mock_debug.assert_called_once_with(
        "组装 prompt [{}]:\n{}",
        "build_system_prompt",
        "你是一位顶级小说作家，擅长构思情节、塑造人物并保持文风统一。",
    )


def test_log_assembled_prompt_returns_unchanged():
    """log_assembled_prompt returns the same string after logging."""
    with patch("app.services.prompts.logger.debug"):
        assert log_assembled_prompt("test", "hello") == "hello"


def test_system_prompt_without_style():
    """The default novelist persona is returned when no style is provided."""
    prompt = build_system_prompt("")
    assert "顶级小说作家" in prompt
    assert "小说创作助手" not in prompt


def test_system_prompt_uses_style_as_full_override():
    """A non-empty writing style fully replaces the default system prompt."""
    prompt = build_system_prompt("简洁冷峻，多用短句。")
    assert prompt == "简洁冷峻，多用短句。"
    assert "顶级小说作家" not in prompt
    assert "写作风格要求" not in prompt


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


def test_assemble_draft_prompt_orders_work_info_before_references():
    """Draft prompts place work info first, then references, then the task."""
    work_info = build_work_info_block(title="昆图库塔传", stages=["开端"])
    references = build_reference_block(
        [ReferencedEntry(name="昆图库塔", category="人物", description="巨龙")]
    )
    requirements = build_draft_requirements(
        chapter_number=1, title="龙醒", summary="苏醒的巨龙巡视山川"
    )
    with patch("app.services.prompts.logger.debug"):
        prompt = assemble_draft_prompt(work_info, references, requirements)

    work_idx = prompt.index("【作品信息】")
    ref_idx = prompt.index("【引用设定】")
    task_idx = prompt.index("请为「第1章《龙醒》」撰写正文。")
    assert work_idx < ref_idx < task_idx
