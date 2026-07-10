"""Tests for Jinja2 prompt template loading and locale symmetry."""

from app.prompts.loader import list_template_names, render_template
from app.services.prompts import build_system_prompt, build_work_info_block


def test_zh_and_en_template_sets_match():
    """Every Chinese template has a matching English file."""
    assert list_template_names("zh") == list_template_names("en")
    assert len(list_template_names("zh")) >= 12


def test_english_system_prompt_uses_default_persona():
    """English locale renders the default novelist instruction in English."""
    prompt = build_system_prompt("", locale="en")
    assert "top-tier novelist" in prompt
    assert "顶级小说作家" not in prompt


def test_english_work_info_block_uses_english_labels():
    """English work info uses [Work Info] section labels."""
    block = build_work_info_block(
        locale="en",
        title="Dragon Slayer",
        structure_name="Three-act",
        stages=["Setup", "Confrontation", "Resolution"],
        summary="A boy hunts a dragon.",
    )
    assert "[Work Info]" in block
    assert "Dragon Slayer" in block
    assert "Setup, Confrontation, Resolution" in block


def test_english_work_info_block_translates_preset_structure():
    """English work info translates preset structure metadata from Chinese keys."""
    from unittest.mock import MagicMock

    from app.services.generation_context import work_info_block

    structure = MagicMock()
    structure.name = "起承转合"
    structure.stages = '["开端", "发展", "转折", "结尾"]'
    structure.description = "东方叙事的经典节奏，注重意境与留白。"
    work = MagicMock()
    work.title = "Blah's Story"
    work.structure = structure
    work.planned_chapter_count = 16
    work.actual_chapter_count = 17
    work.summary = "Blah, blah, blah, blah!"

    block = work_info_block(work, locale="en")
    assert "Kishōtenketsu" in block
    assert "Introduction, Development, Twist, Conclusion" in block
    assert "East Asian" in block
    assert "起承转合" not in block
    assert "开端" not in block


def test_render_template_falls_back_to_chinese_for_unknown_locale():
    """Unsupported locale tags fall back to Chinese templates."""
    text = render_template("fr", "system/default.j2")
    assert "顶级小说作家" in text
