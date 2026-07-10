"""Locale-aware string formatting helpers shared by prompt templates."""

from app.deps.locale import PromptLocale


def join_items(locale: PromptLocale, items: list[str]) -> str:
    """Join a list with locale-appropriate separators, or return a none-placeholder."""
    if not items:
        return none_text(locale, "none")
    separator = "、" if locale == "zh" else ", "
    return separator.join(items)


def chapter_heading(locale: PromptLocale, number: int, title: str | None = None) -> str:
    """Format a chapter label for prompt headings (e.g. 第3章《龙醒》)."""
    if locale == "en":
        if title:
            return f'Chapter {number}: "{title}"'
        return f"Chapter {number}"
    if title:
        return f"第{number}章《{title}》"
    return f"第{number}章"


def chapter_label(locale: PromptLocale, number: int) -> str:
    """Format a short chapter reference (e.g. 第3章 / Chapter 3)."""
    return f"Chapter {number}" if locale == "en" else f"第{number}章"


def none_text(locale: PromptLocale, kind: str = "empty") -> str:
    """Return a localized placeholder for missing optional fields."""
    if locale == "en":
        return {"none": "(none)", "empty": "(not available)", "no_body": "(no body yet)"}.get(
            kind, "(not available)"
        )
    return {"none": "（无）", "empty": "（暂无）", "no_body": "（暂无正文）"}.get(kind, "（暂无）")
