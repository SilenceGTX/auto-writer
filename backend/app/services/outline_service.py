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
