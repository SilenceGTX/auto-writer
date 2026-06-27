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
