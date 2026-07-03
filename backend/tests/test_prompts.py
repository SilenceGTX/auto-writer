"""Tests for the prompt assembly helpers."""

from unittest.mock import patch

from app.services.prompts import build_system_prompt, build_work_info_block, log_assembled_prompt


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
