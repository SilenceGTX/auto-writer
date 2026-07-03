"""Prompt assembly helpers for LLM requests.

Builds the reusable prompt fragments described in ``STORY_PAGE_DESIGN.md`` §5,
such as the work-information block and the system prompt that injects the
user's global writing style. Each builder logs the assembled text at DEBUG
via loguru.
"""

import functools
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from loguru import logger

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


@_log_prompt_builder
def build_system_prompt(writing_style: str = "") -> str:
    """Build the system prompt, using the user's writing style when provided.

    When ``writing_style`` is non-empty it fully replaces the default persona;
    otherwise a default top-tier novelist instruction is used.
    """
    style = writing_style.strip()
    if style:
        return style
    return "你是一位顶级小说作家，擅长构思情节、塑造人物并保持文风统一。"


@_log_prompt_builder
def build_work_info_block(
    *,
    title: str,
    structure_name: str | None = None,
    stages: list[str] | None = None,
    structure_description: str | None = None,
    planned_chapter_count: int | None = None,
    actual_chapter_count: int | None = None,
    summary: str | None = None,
) -> str:
    """Build the 【作品信息】 prompt block (``STORY_PAGE_DESIGN.md`` §5.2)."""
    stage_text = "、".join(stages) if stages else "（无）"
    lines = [
        "【作品信息】",
        f"- 作品名称：{title}",
        f"- 故事结构：{structure_name or '（未指定）'}（阶段：{stage_text}）",
    ]
    if structure_description:
        lines.append(f"- 结构说明：{structure_description}")
    if planned_chapter_count is not None:
        lines.append(f"- 预计章节数：{planned_chapter_count}")
    if actual_chapter_count is not None:
        lines.append(f"- 实际章节数：{actual_chapter_count}")
    lines.append(f"- 作品简介：{summary or '（暂无）'}")
    return "\n".join(lines)


@_log_prompt_builder
def build_stage_generation_prompt(
    work_info: str, stages: list[str], planned_chapter_count: int | None
) -> str:
    """Build the user prompt asking the LLM to generate the stage tree.

    The model must allocate a chapter count to each stage and write a synopsis
    (总纲) for it, returning a strict JSON array so the result can be parsed.
    """
    stage_list = "、".join(stages)
    target = (
        f"全书计划约 {planned_chapter_count} 章，请据此分配各阶段章节数。"
        if planned_chapter_count
        else "请根据故事节奏为各阶段分配合理的章节数。"
    )
    return (
        f"{work_info}\n\n"
        f"故事结构阶段（按顺序）：{stage_list}\n"
        f"{target}\n\n"
        "请为每个阶段分配章节数量，并撰写一段该阶段的内容概述（总纲），"
        "概述需体现该阶段的关键剧情走向。\n"
        "仅返回 JSON 数组，不要包含解释或 Markdown 代码块，格式如下：\n"
        '[{"name": "阶段名", "chapter_count": 整数, "overview": "该阶段内容概述"}]'
    )


@_log_prompt_builder
def build_draft_requirements(
    *,
    chapter_number: int,
    title: str | None,
    summary: str | None,
    recap: str | None = None,
) -> str:
    """Build the draft writing-task section (recap, chapter brief, and constraints)."""
    lines: list[str] = []
    if recap and recap.strip():
        lines.append(f"【前情提要】\n{recap.strip()}")
        lines.append("")
    heading = f"第{chapter_number}章" + (f"《{title}》" if title else "")
    lines.append(f"请为「{heading}」撰写正文。")
    summary_text = summary.strip() if summary and summary.strip() else "（暂无，请合理发挥）"
    lines.append(f"本章内容概述：{summary_text}")
    lines.append(
        "要求：直接输出本章正文文本，不要输出标题、解释或 Markdown 代码块；"
        "保持与作品设定、前情提要一致，行文流畅。"
    )
    return "\n".join(lines)


def assemble_draft_prompt(work_info: str, reference_block: str, requirements: str) -> str:
    """Assemble the draft user prompt: work info, then references, then the task."""
    parts = [work_info.strip()]
    if reference_block.strip():
        parts.append(reference_block.strip())
    parts.append(requirements.strip())
    return log_assembled_prompt("assemble_draft_prompt", "\n\n".join(parts))


@_log_prompt_builder
def build_recap_prompt(*, chapter_number: int, title: str | None, content: str) -> str:
    """Build the user prompt asking the LLM to summarize a chapter's content."""
    heading = f"第{chapter_number}章" + (f"《{title}》" if title else "")
    return (
        f"请用简洁的语言总结「{heading}」的剧情，作为后续章节写作的前情提要。"
        "突出关键事件、人物动向与悬念，控制在 200 字以内，直接输出总结文本。\n\n"
        f"【本章正文】\n{content.strip()}"
    )


@_log_prompt_builder
def build_rewrite_prompt(
    *,
    selection: str,
    instruction: str | None,
    context: str | None,
    preceding: str | None = None,
    following: str | None = None,
) -> str:
    """Build the user prompt asking the LLM to rewrite a selected passage.

    When ``preceding`` / ``following`` (the surrounding paragraphs) are provided,
    the model is asked to keep the rewrite cohesive with them while still only
    returning the rewritten passage itself.
    """
    lines = []
    if context and context.strip():
        lines.append(f"【上下文（仅供参考，不要改写）】\n{context.strip()}")
        lines.append("")
    has_neighbors = bool((preceding and preceding.strip()) or (following and following.strip()))
    if preceding and preceding.strip():
        lines.append(f"【上文（重写内容的前文，保持衔接，不要改写）】\n{preceding.strip()}")
        lines.append("")
    if following and following.strip():
        lines.append(f"【下文（重写内容的后文，保持衔接，不要改写）】\n{following.strip()}")
        lines.append("")
    requirement = (
        instruction.strip()
        if instruction and instruction.strip()
        else "在保持原意的前提下润色，使表达更生动流畅"
    )
    lines.append(f"请按照以下要求重写下面这段文字：{requirement}")
    if has_neighbors:
        lines.append("并在重写段落的基础上，确保与上文、下文自然衔接、语气连贯。")
    lines.append("仅输出重写后的文字，不要包含解释、标题、引号，也不要重复上文或下文的内容。")
    lines.append("")
    lines.append(f"【待重写文字】\n{selection.strip()}")
    return "\n".join(lines)


@_log_prompt_builder
def build_chat_context_block(
    *,
    work_info: str,
    chapter_number: int | None = None,
    chapter_title: str | None = None,
    chapter_summary: str | None = None,
    quoted: str | None = None,
) -> str:
    """Build a context preface for the writing assistant chat (current chapter)."""
    lines = [work_info]
    if chapter_number is not None:
        heading = f"第{chapter_number}章" + (f"《{chapter_title}》" if chapter_title else "")
        lines.append(f"\n当前章节：{heading}")
        if chapter_summary and chapter_summary.strip():
            lines.append(f"本章概述：{chapter_summary.strip()}")
    if quoted and quoted.strip():
        lines.append(f"\n用户引用的正文片段：\n{quoted.strip()}")
    return "\n".join(lines)


@_log_prompt_builder
def build_review_instruction() -> str:
    """Build the system instruction framing the assistant as a manuscript editor.

    Used by the review assistant (``REVIEW_PAGE_DESIGN.md`` §3) so the model
    checks the manuscript for continuity, character/setting consistency, plot
    holes and wording issues, then gives concrete, actionable suggestions.
    """
    return (
        "请以资深小说编辑的视角审阅用户提供的正文与引用片段："
        "检查前后情节是否连贯、人物与设定是否自洽、是否存在逻辑硬伤、节奏问题或表达瑕疵，"
        "并给出具体、可操作的修改建议。回答需条理清晰、有针对性，必要时引用原文定位问题。"
    )


@_log_prompt_builder
def build_chapter_generation_prompt(
    work_info: str, stages: list[dict[str, object]], chapter_numbers: list[int]
) -> str:
    """Build the user prompt asking the LLM to generate per-chapter outlines.

    ``stages`` carries each stage's name, synopsis, and the chapter numbers that
    belong to it so the model can write coherent chapter-level summaries.
    """
    stage_lines = []
    for stage in stages:
        numbers = stage.get("chapter_numbers") or []
        numbers_text = "、".join(f"第{n}章" for n in numbers) if numbers else "（无）"
        overview = stage.get("overview") or "（暂无）"
        stage_lines.append(f"- 阶段「{stage.get('name')}」（{numbers_text}）概述：{overview}")
    chapters_text = "、".join(f"第{n}章" for n in chapter_numbers)
    return (
        f"{work_info}\n\n"
        "各阶段概述与章节归属：\n" + "\n".join(stage_lines) + "\n\n"
        f"请为以下章节分别撰写标题与内容概述（每章大致写什么）：{chapters_text}\n"
        "仅返回 JSON 数组，不要包含解释或 Markdown 代码块，格式如下：\n"
        '[{"chapter_number": 整数, "title": "章节标题", "summary": "本章内容概述"}]'
    )
