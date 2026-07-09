"""Resolve the request locale from ``Accept-Language`` (``designs/I18N.md`` §4.3)."""

from typing import Annotated, Literal

from fastapi import Header

PromptLocale = Literal["zh", "en"]


def normalize_locale(value: str | None) -> PromptLocale:
    """Map an ``Accept-Language`` tag (or stored setting) to ``zh`` or ``en``."""
    if not value:
        return "zh"
    primary = value.split(",")[0].split(";")[0].strip().lower()
    if primary.startswith("en"):
        return "en"
    if primary.startswith("zh"):
        return "zh"
    return "zh"


def get_request_locale(
    accept_language: Annotated[str | None, Header(alias="Accept-Language")] = None,
) -> PromptLocale:
    """FastAPI dependency that returns the caller's preferred locale."""
    return normalize_locale(accept_language)
