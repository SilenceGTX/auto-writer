"""Prompt assembly helpers for LLM requests.

Builds the reusable prompt fragments described in ``STORY_PAGE_DESIGN.md`` §5,
such as the work-information block and the system prompt that injects the
user's global writing style.
"""


def build_system_prompt(writing_style: str = "") -> str:
    """Build the base system prompt, optionally injecting the writing style."""
    base = "你是一位专业的小说创作助手，擅长构思情节、塑造人物并保持文风统一。"
    style = writing_style.strip()
    if style:
        return f"{base}\n\n【写作风格要求】\n{style}"
    return base


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
