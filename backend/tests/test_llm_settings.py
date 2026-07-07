"""Tests for multi-LLM settings helpers."""

from app.services.llm_settings import (
    default_assignments,
    normalize_llm_settings,
    normalize_preferences,
    profile_from_legacy_connection,
    sanitize_assignments,
    validate_llm_payload,
)


def test_normalize_llm_settings_from_legacy_connection():
    """Legacy single-connection storage migrates to one profile and assignments."""
    stored = {"connection": {"url": "https://x/chat", "api_token": "t", "model": "m"}}
    normalized, changed = normalize_llm_settings(stored)
    assert changed is True
    assert len(normalized["profiles"]) == 1
    assert normalized["profiles"][0]["url"] == "https://x/chat"
    assert normalized["assignments"]["writing_chat"] == normalized["profiles"][0]["id"]


def test_sanitize_assignments_falls_back_to_first_profile():
    """Invalid assignment ids are replaced with the first profile id."""
    profiles = [
        {"id": "a", "url": "https://a", "api_token": "", "model": "a"},
        {"id": "b", "url": "https://b", "api_token": "", "model": "b"},
    ]
    assignments = default_assignments("a")
    assignments["writing_chat"] = "missing"
    sanitized = sanitize_assignments(assignments, profiles)
    assert sanitized["writing_chat"] == "a"


def test_validate_llm_payload_rejects_duplicate_ids():
    """Duplicate profile ids are rejected during validation."""
    profiles = [
        {"id": "same", "url": "https://a", "api_token": "", "model": "a"},
        {"id": "same", "url": "https://b", "api_token": "", "model": "b"},
    ]
    assignments = default_assignments("same")
    try:
        validate_llm_payload(profiles, assignments)
    except ValueError as exc:
        assert "Duplicate" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_normalize_preferences_adds_review_group():
    """Older preference documents gain a review group."""
    merged = normalize_preferences({"outline": {"temperature": 0.7}})
    assert merged["review"]["temperature"] == 0.3


def test_profile_from_legacy_connection_preserves_fields():
    """Legacy connection fields are copied into a profile dict."""
    profile = profile_from_legacy_connection(
        {"url": "https://x", "api_token": "token", "model": "gpt"}
    )
    assert profile["url"] == "https://x"
    assert profile["model"] == "gpt"
    assert profile["id"]
