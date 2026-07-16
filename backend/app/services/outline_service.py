"""Helper functions for outline generation and chapter bookkeeping.

Holds the pure, testable pieces used by the outline router: defensive parsing
of LLM JSON output, even chapter-count allocation across stages, and chapter
renumbering. Database orchestration lives in ``app/routers/outline.py``.
"""

import json
import re
from typing import Any

from loguru import logger

_JSON_ARRAY = re.compile(r"\[.*\]", re.DOTALL)
_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)
_PREVIEW_CHARS = 800


def response_tail(text: str, chars: int = _PREVIEW_CHARS) -> str:
    """Return the last ``chars`` of *text* for truncated-output debugging."""
    if not text:
        return "(empty)"
    if len(text) <= chars:
        return text
    return text[-chars:]


def log_llm_parse_failure(
    *,
    context: str,
    content: str,
    error: BaseException | None = None,
) -> None:
    """Log usage, finish_reason, and both ends of a response that failed to parse."""
    usage = getattr(content, "usage", None)
    finish_reason = getattr(content, "finish_reason", None)
    logger.error(
        "{}：LLM JSON 解析失败 error={} finish_reason={} usage={} "
        "response_len={} head=\n{}\ntail=\n{}",
        context,
        error,
        finish_reason,
        usage,
        len(content) if content else 0,
        (content[:_PREVIEW_CHARS] if content else "(empty)"),
        response_tail(content or ""),
    )


def extract_json(text: str) -> Any:
    """Parse the first JSON array/object found in an LLM response.

    Tolerates Markdown code fences and surrounding prose by extracting the
    outermost ``[...]`` (preferred) or ``{...}`` span before decoding.
    """
    cleaned = text.strip()
    try:
        return json.loads(cleaned)
    except (ValueError, TypeError) as exc:
        logger.debug(
            "extract_json: 整段 JSON 解析失败 ({}: {})，尝试从正文中截取数组/对象",
            type(exc).__name__,
            exc,
        )
    for pattern in (_JSON_ARRAY, _JSON_OBJECT):
        match = pattern.search(cleaned)
        if match:
            snippet = match.group(0)
            try:
                parsed = json.loads(snippet)
                logger.debug(
                    "extract_json: 从截取片段解析成功 pattern={} 长度={}",
                    pattern.pattern,
                    len(snippet),
                )
                return parsed
            except ValueError as exc:
                logger.debug(
                    "extract_json: 截取片段仍无法解析 pattern={} error={} preview=\n{}",
                    pattern.pattern,
                    exc,
                    snippet[:_PREVIEW_CHARS],
                )
                continue
    logger.debug(
        "extract_json: 无法从 LLM 响应中解析 JSON，原文预览 (len={}):\n{}",
        len(cleaned),
        cleaned[:_PREVIEW_CHARS],
    )
    raise ValueError("无法从 LLM 响应中解析 JSON")


# Retries for one stage when JSON is invalid or chapter coverage is incomplete.
CHAPTER_OUTLINE_MAX_ATTEMPTS = 3

# Prefer JSON mode when the endpoint supports OpenAI-compatible response_format.
CHAPTER_OUTLINE_RESPONSE_FORMAT = {"type": "json_object"}


def extract_chapter_outline_items(text: str) -> list[Any]:
    """Parse chapter-outline LLM output as a list of chapter objects.

    Accepts ``{"chapters": [...]}`` (preferred with JSON mode) or a bare array
    for backward compatibility with older model replies.
    """
    parsed = extract_json(text)
    if isinstance(parsed, dict):
        items = parsed.get("chapters")
        if not isinstance(items, list):
            raise ValueError("无法从 LLM 响应中解析 JSON：缺少 chapters 数组")
        return items
    if isinstance(parsed, list):
        return parsed
    raise ValueError("无法从 LLM 响应中解析 JSON：期望对象或数组")


def index_chapter_outline_items(
    items: list[Any], *, allowed_numbers: list[int]
) -> dict[int, dict]:
    """Map valid chapter items to ``chapter_number`` within *allowed_numbers*."""
    allowed = set(allowed_numbers)
    by_number: dict[int, dict] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            number = int(item.get("chapter_number"))
        except (TypeError, ValueError):
            continue
        if number not in allowed:
            continue
        by_number[number] = item
    return by_number


def allocate_chapter_counts(num_stages: int, total: int) -> list[int]:
    """Distribute ``total`` chapters across stages as evenly as possible.

    Each stage receives at least one chapter; any remainder is assigned to the
    earliest stages. Used as a fallback when the LLM omits chapter counts.
    """
    if num_stages <= 0:
        return []
    total = max(total, num_stages)
    base, remainder = divmod(total, num_stages)
    return [base + (1 if index < remainder else 0) for index in range(num_stages)]
