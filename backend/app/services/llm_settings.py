"""Multi-LLM profile storage, task assignments, and legacy settings migration."""

from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

CONNECTION_KEY = "connection"

LLM_PROFILES_KEY = "llm_profiles"
LLM_ASSIGNMENTS_KEY = "llm_assignments"
MAX_LLM_PROFILES = 5

LLM_TASKS: tuple[str, ...] = (
    "outline_stages",
    "outline_chapters",
    "writing_draft",
    "writing_chat",
    "writing_rewrite",
    "review_chat",
)

TASK_PREFERENCE_GROUP: dict[str, str] = {
    "outline_stages": "outline",
    "outline_chapters": "outline",
    "writing_draft": "writing",
    "writing_chat": "writing",
    "writing_rewrite": "writing",
    "review_chat": "review",
}

TASK_LABELS: dict[str, str] = {
    "outline_stages": "阶段树生成",
    "outline_chapters": "章节大纲生成",
    "writing_draft": "初稿生成（含前情提要）",
    "writing_chat": "写作辅助区聊天",
    "writing_rewrite": "局部重写",
    "review_chat": "审阅辅助区聊天",
}

_DEFAULT_REVIEW_PREFERENCE = {
    "temperature": 0.3,
    "top_p": 0.85,
    "presence_penalty": 0.3,
    "frequency_penalty": 0.3,
    "max_tokens": 2048,
}


def default_review_preference() -> dict[str, Any]:
    """Return the default sampling parameters for review-stage LLM calls."""
    return deepcopy(_DEFAULT_REVIEW_PREFERENCE)


def default_assignments(profile_id: str) -> dict[str, str]:
    """Assign every task to the given profile id."""
    return {task: profile_id for task in LLM_TASKS}


def new_profile_id() -> str:
    """Generate a stable unique id for a new LLM profile."""
    return str(uuid.uuid4())


def profile_from_legacy_connection(connection: dict[str, Any]) -> dict[str, Any]:
    """Build one profile dict from the legacy single-connection settings shape."""
    return {
        "id": new_profile_id(),
        "url": connection.get("url") or "",
        "api_token": connection.get("api_token") or "",
        "model": connection.get("model") or "",
    }


def normalize_preferences(preferences: dict[str, Any]) -> dict[str, Any]:
    """Ensure the review preference group exists."""
    merged = deepcopy(preferences)
    if "review" not in merged:
        merged["review"] = default_review_preference()
    return merged


def normalize_llm_settings(stored: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Migrate legacy ``connection`` settings and sanitize assignments.

    *stored* should be the raw key/value map from the database, not merged
    defaults, so legacy installs that only saved ``connection`` still migrate.
    """
    changed = False
    profiles = stored.get(LLM_PROFILES_KEY)
    assignments = stored.get(LLM_ASSIGNMENTS_KEY)

    if profiles is None:
        legacy = stored.get(CONNECTION_KEY) or {}
        profile = profile_from_legacy_connection(legacy)
        profiles = [profile]
        assignments = default_assignments(profile["id"])
        changed = True
    else:
        profiles = deepcopy(profiles)

    if assignments is None:
        assignments = default_assignments(profiles[0]["id"])
        changed = True
    else:
        assignments = deepcopy(assignments)

    sanitized = sanitize_assignments(assignments, profiles)
    if sanitized != assignments:
        assignments = sanitized
        changed = True

    return {"profiles": profiles, "assignments": assignments}, changed


def sanitize_assignments(
    assignments: dict[str, Any], profiles: list[dict[str, Any]]
) -> dict[str, str]:
    """Fallback invalid or missing task assignments to the first profile."""
    if not profiles:
        raise ValueError("At least one LLM profile is required")
    fallback = profiles[0]["id"]
    valid_ids = {profile["id"] for profile in profiles}
    normalized: dict[str, str] = {}
    for task in LLM_TASKS:
        profile_id = str(assignments.get(task) or fallback)
        normalized[task] = profile_id if profile_id in valid_ids else fallback
    return normalized


def find_profile(profiles: list[dict[str, Any]], profile_id: str) -> dict[str, Any]:
    """Return the profile dict for *profile_id* or raise ``ValueError``."""
    for profile in profiles:
        if profile.get("id") == profile_id:
            return profile
    raise ValueError(f"Unknown LLM profile id: {profile_id}")


def validate_llm_payload(profiles: list[dict[str, Any]], assignments: dict[str, str]) -> None:
    """Validate profile count, uniqueness, and assignment references."""
    if not profiles:
        raise ValueError("At least one LLM profile is required")
    if len(profiles) > MAX_LLM_PROFILES:
        raise ValueError(f"At most {MAX_LLM_PROFILES} LLM profiles are allowed")

    seen: set[str] = set()
    for profile in profiles:
        profile_id = profile.get("id")
        if not profile_id:
            raise ValueError("Each LLM profile requires an id")
        if profile_id in seen:
            raise ValueError(f"Duplicate LLM profile id: {profile_id}")
        seen.add(profile_id)
        if not (profile.get("url") or "").strip():
            raise ValueError("Each LLM profile requires a URL")

    sanitize_assignments(assignments, profiles)
