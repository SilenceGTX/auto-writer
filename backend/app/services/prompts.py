"""Prompt assembly helpers for LLM requests.

Builds reusable prompt fragments from locale-specific Jinja2 templates under
``app/prompts/templates/``. User-authored content (writing style, manuscript
text, entity names) is injected as data and is never translated.
"""

import functools
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from loguru import logger

from app.deps.locale import PromptLocale, normalize_locale
from app.prompts.formatting import chapter_heading, chapter_label, join_items, none_text
from app.prompts.loader import render_template
from app.services.story_structure_i18n import translate_preset_stage_name

P = ParamSpec("P")
R = TypeVar("R")


def log_assembled_prompt(label: str, prompt: str) -> str:
    """Record a fully assembled prompt at DEBUG level and return it unchanged."""
    logger.debug("组装 prompt [{}]:\n{}", label, prompt)
    return prompt


def log_chat_messages(label: str, messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Record an assembled chat message list at DEBUG level."""
    parts: list[str] = []
    for message in messages:
        parts.append(f"--- [{message['role']}] ---")
        parts.append(message["content"])
    logger.debug("组装 prompt [{}]:\n{}", label, "\n".join(parts))
    return messages


def _log_prompt_builder(func: Callable[P, str]) -> Callable[P, str]:
    """Decorator that DEBUG-logs the string returned by a prompt builder."""

    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> str:
        result = func(*args, **kwargs)
        log_assembled_prompt(func.__name__, result)
        return result

    return wrapper


def _locale(locale: str | None) -> PromptLocale:
    """Normalize an optional locale string for template rendering."""
    return normalize_locale(locale)


@_log_prompt_builder
def build_system_prompt(writing_style: str = "", *, locale: str | None = None) -> str:
    """Build the system prompt, using the user's writing style when provided.

    When ``writing_style`` is non-empty it fully replaces the default persona;
    otherwise the locale-specific default novelist instruction is used.
    """
    style = writing_style.strip()
    if style:
        return style
    return render_template(_locale(locale), "system/default.j2")


@_log_prompt_builder
def build_work_info_block(
    *,
    locale: str | None = None,
    title: str,
    structure_name: str | None = None,
    stages: list[str] | None = None,
    structure_description: str | None = None,
    planned_chapter_count: int | None = None,
    actual_chapter_count: int | None = None,
    summary: str | None = None,
) -> str:
    """Build the work-information prompt block (``STORY_PAGE_DESIGN.md`` §5.2)."""
    loc = _locale(locale)
    if loc == "zh":
        structure_display = structure_name or "（未指定）"
    else:
        structure_display = structure_name or "(unspecified)"
    return render_template(
        loc,
        "blocks/work_info.j2",
        title=title,
        structure_name=structure_display,
        stages_text=join_items(loc, stages or []),
        structure_description=structure_description,
        planned_chapter_count=planned_chapter_count,
        actual_chapter_count=actual_chapter_count,
        summary=summary or none_text(loc, "empty"),
    )


@_log_prompt_builder
def build_stage_generation_prompt(
    work_info: str,
    stages: list[str],
    planned_chapter_count: int | None,
    *,
    structure_name: str | None = None,
    locale: str | None = None,
) -> str:
    """Build the user prompt asking the LLM to generate the stage tree."""
    loc = _locale(locale)
    display_stages = [
        translate_preset_stage_name(structure_name, stage, loc) for stage in stages
    ]
    if loc == "zh":
        chapter_target = (
            f"全书计划约 {planned_chapter_count} 章，请据此分配各阶段章节数。"
            if planned_chapter_count
            else "请根据故事节奏为各阶段分配合理的章节数。"
        )
    else:
        chapter_target = (
            (
                f"The work is planned for about {planned_chapter_count} chapters—"
                "allocate counts accordingly."
            )
            if planned_chapter_count
            else "Allocate a reasonable chapter count per stage based on story pacing."
        )
    return render_template(
        loc,
        "tasks/stage_generation.j2",
        work_info=work_info,
        stage_list=join_items(loc, display_stages),
        chapter_target=chapter_target,
        stage_count=len(stages),
    )


@_log_prompt_builder
def build_draft_requirements(
    *,
    locale: str | None = None,
    chapter_number: int,
    title: str | None,
    summary: str | None,
    recap: str | None = None,
) -> str:
    """Build the draft writing-task section (recap, chapter brief, and constraints)."""
    loc = _locale(locale)
    recap_text = recap.strip() if recap and recap.strip() else None
    summary_text = summary.strip() if summary and summary.strip() else none_text(loc, "empty")
    if loc == "en" and summary_text == none_text(loc, "empty"):
        summary_text = "(none yet—use your judgment)"
    elif loc == "zh" and summary_text == none_text(loc, "empty"):
        summary_text = "（暂无，请合理发挥）"
    return render_template(
        loc,
        "tasks/draft_requirements.j2",
        recap=recap_text,
        chapter_heading=chapter_heading(loc, chapter_number, title),
        summary_text=summary_text,
    )


def assemble_draft_prompt(work_info: str, reference_block: str, requirements: str) -> str:
    """Assemble the draft user prompt: work info, then references, then the task."""
    parts = [work_info.strip()]
    if reference_block.strip():
        parts.append(reference_block.strip())
    parts.append(requirements.strip())
    return log_assembled_prompt("assemble_draft_prompt", "\n\n".join(parts))


@_log_prompt_builder
def build_recap_prompt(
    *,
    locale: str | None = None,
    chapter_number: int,
    title: str | None,
    content: str,
) -> str:
    """Build the user prompt asking the LLM to summarize a chapter's content."""
    loc = _locale(locale)
    return render_template(
        loc,
        "tasks/recap.j2",
        chapter_heading=chapter_heading(loc, chapter_number, title),
        content=content.strip(),
    )


@_log_prompt_builder
def build_rewrite_prompt(
    *,
    locale: str | None = None,
    selection: str,
    instruction: str | None,
    context: str | None,
    preceding: str | None = None,
    following: str | None = None,
) -> str:
    """Build the user prompt asking the LLM to rewrite a selected passage."""
    loc = _locale(locale)
    context_text = context.strip() if context and context.strip() else None
    preceding_text = preceding.strip() if preceding and preceding.strip() else None
    following_text = following.strip() if following and following.strip() else None
    has_neighbors = bool(preceding_text or following_text)
    if instruction and instruction.strip():
        requirement = instruction.strip()
    elif loc == "en":
        requirement = (
            "Polish the passage while preserving its meaning; "
            "make it more vivid and fluent."
        )
    else:
        requirement = "在保持原意的前提下润色，使表达更生动流畅"
    return render_template(
        loc,
        "tasks/rewrite.j2",
        context=context_text,
        preceding=preceding_text,
        following=following_text,
        requirement=requirement,
        has_neighbors=has_neighbors,
        selection=selection.strip(),
    )


@_log_prompt_builder
def build_chat_context_block(
    *,
    locale: str | None = None,
    work_info: str,
    chapter_number: int | None = None,
    chapter_title: str | None = None,
    chapter_summary: str | None = None,
    quoted: str | None = None,
) -> str:
    """Build a context preface for the writing assistant chat (current chapter)."""
    loc = _locale(locale)
    quoted_text = quoted.strip() if quoted and quoted.strip() else None
    summary_text = chapter_summary.strip() if chapter_summary and chapter_summary.strip() else None
    return render_template(
        loc,
        "blocks/chat_context.j2",
        work_info=work_info,
        chapter_number=chapter_number,
        chapter_heading=chapter_heading(loc, chapter_number, chapter_title)
        if chapter_number is not None
        else None,
        chapter_summary=summary_text,
        quoted=quoted_text,
    )


@_log_prompt_builder
def build_review_instruction(*, locale: str | None = None) -> str:
    """Build the system instruction framing the assistant as a manuscript editor."""
    return render_template(_locale(locale), "tasks/review_instruction.j2")


@_log_prompt_builder
def build_review_context_block(
    *,
    locale: str | None = None,
    summary: str | None,
    chapter_number: int | None = None,
    chapter_title: str | None = None,
    chapter_summary: str | None = None,
    chapter_content: str | None = None,
) -> str:
    """Build the static review context block (summary, chapter outline, chapter body)."""
    loc = _locale(locale)
    summary_text = summary.strip() if summary and summary.strip() else none_text(loc, "empty")
    if chapter_number is None:
        return render_template(loc, "blocks/review_context.j2", summary=summary_text)
    overview = (
        chapter_summary.strip()
        if chapter_summary and chapter_summary.strip()
        else none_text(loc, "empty")
    )
    body = (
        chapter_content.strip()
        if chapter_content and chapter_content.strip()
        else none_text(loc, "no_body")
    )
    return render_template(
        loc,
        "blocks/review_context.j2",
        summary=summary_text,
        chapter_number=chapter_number,
        chapter_heading=chapter_heading(loc, chapter_number, chapter_title),
        chapter_summary=overview,
        chapter_content=body,
    )


def _stage_rows(
    locale: PromptLocale,
    stages: list[dict[str, object]],
    *,
    structure_name: str | None = None,
) -> list[dict[str, str]]:
    """Prepare per-stage lines for the chapter-generation template."""
    rows: list[dict[str, str]] = []
    for stage in stages:
        numbers = stage.get("chapter_numbers") or []
        if numbers:
            numbers_text = join_items(locale, [chapter_label(locale, int(n)) for n in numbers])
        else:
            numbers_text = none_text(locale, "none")
        overview = str(stage.get("overview") or none_text(locale, "empty"))
        raw_name = str(stage.get("name") or "")
        rows.append(
            {
                "name": translate_preset_stage_name(structure_name, raw_name, locale),
                "numbers_text": numbers_text,
                "overview": overview,
            }
        )
    return rows


@_log_prompt_builder
def build_chapter_generation_prompt(
    work_info: str,
    stages: list[dict[str, object]],
    chapter_numbers: list[int],
    *,
    structure_name: str | None = None,
    locale: str | None = None,
) -> str:
    """Build the user prompt asking the LLM to generate per-chapter outlines."""
    loc = _locale(locale)
    chapters_text = join_items(loc, [chapter_label(loc, number) for number in chapter_numbers])
    return render_template(
        loc,
        "tasks/chapter_generation.j2",
        work_info=work_info,
        stage_rows=_stage_rows(loc, stages, structure_name=structure_name),
        chapters_text=chapters_text,
        chapter_count=len(chapter_numbers),
    )


def wrap_quoted_user_message(
    question: str, quoted: str | None, *, locale: str | None = None
) -> str:
    """Wrap the last user turn with a quoted manuscript passage when present."""
    if not quoted or not quoted.strip():
        return question
    return render_template(
        _locale(locale),
        "chat/quote_user.j2",
        quoted=quoted.strip(),
        question=question,
    )
