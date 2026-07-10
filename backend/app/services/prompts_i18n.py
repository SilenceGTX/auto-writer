"""Locale helpers for bilingual LLM prompt templates (``designs/I18N.md`` §6).

Templates live under ``app/prompts/templates/{zh,en}/`` and are rendered via
``app.prompts.loader.render_template``. Generation routers should depend on
``app.deps.locale.get_request_locale``.
"""

from app.deps.locale import PromptLocale, normalize_locale

__all__ = ["PromptLocale", "normalize_prompt_locale"]


def normalize_prompt_locale(locale: str | None) -> PromptLocale:
    """Return a supported prompt locale, defaulting to Chinese."""
    return normalize_locale(locale)
