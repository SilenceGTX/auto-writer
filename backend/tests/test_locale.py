"""Tests for locale normalization helpers."""

from app.deps.locale import normalize_locale


def test_normalize_locale_defaults_to_chinese():
    """Missing or unknown tags fall back to zh."""
    assert normalize_locale(None) == "zh"
    assert normalize_locale("") == "zh"
    assert normalize_locale("fr-FR") == "zh"


def test_normalize_locale_maps_english():
    """English Accept-Language tags map to en."""
    assert normalize_locale("en") == "en"
    assert normalize_locale("en-US") == "en"


def test_normalize_locale_maps_chinese():
    """Chinese Accept-Language tags map to zh."""
    assert normalize_locale("zh") == "zh"
    assert normalize_locale("zh-CN") == "zh"
