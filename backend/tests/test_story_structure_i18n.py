"""Tests for preset story structure prompt i18n helpers."""

from app.services.story_structure_i18n import (
    canonical_stage_name,
    index_stage_generation_results,
    translate_preset_stage_name,
    translate_preset_structure_description,
    translate_preset_structure_name,
    translate_stage_names,
)


def test_translate_preset_structure_name_to_english():
    """Preset structure names render in English for English prompts."""
    assert translate_preset_structure_name("起承转合", "en") == "Kishōtenketsu"
    assert translate_preset_structure_name("三幕式", "en") == "Three-act structure"
    assert translate_preset_structure_name("起承转合", "zh") == "起承转合"


def test_translate_preset_stages_to_english():
    """Preset stage labels render in English when the structure is known."""
    stages = translate_stage_names("起承转合", ["开端", "发展", "转折", "结尾"], "en")
    assert stages == ["Introduction", "Development", "Twist", "Conclusion"]
    assert (
        translate_preset_stage_name("三幕式", "铺垫", "en") == "Setup"
    )


def test_translate_preset_structure_description_to_english():
    """Preset structure descriptions use English copy in English prompts."""
    text = translate_preset_structure_description(
        "起承转合", "东方叙事的经典节奏，注重意境与留白。", "en"
    )
    assert "East Asian" in text
    assert "东方" not in text


def test_canonical_stage_name_maps_english_back_to_chinese():
    """LLM responses with English stage names map back to stored Chinese keys."""
    assert canonical_stage_name("起承转合", "Introduction") == "开端"
    assert canonical_stage_name("起承转合", "开端") == "开端"
    assert canonical_stage_name("我的结构", "Act 1") == "Act 1"


def test_index_stage_generation_results_normalizes_english_names():
    """Parsed stage JSON is indexed by canonical Chinese preset names."""
    parsed = [
        {"name": "Introduction", "chapter_count": 4, "overview": "setup"},
        {"name": "Development", "chapter_count": 4, "overview": "rise"},
    ]
    by_name = index_stage_generation_results(parsed, "起承转合")
    assert by_name["开端"]["chapter_count"] == 4
    assert by_name["发展"]["overview"] == "rise"
