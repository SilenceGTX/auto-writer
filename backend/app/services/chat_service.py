"""Shared assembly of writing / review assistant chat messages.

The writing assistant (``WRITING_PAGE_DESSIGN.md`` §3) uses ``build_chat_messages``.
The review assistant (``REVIEW_PAGE_DESIGN.md`` §3) uses ``build_review_chat_messages``,
which injects work summary, chapter outline/body, and ``@`` references into a
dedicated system context block while attaching optional quoted passages to the
last user turn.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.locale import PromptLocale
from app.models import Chapter, Work
from app.schemas import ChatMessage, ChatRequest
from app.services.generation_context import work_info_block
from app.services.prompts import (
    build_chat_context_block,
    build_review_context_block,
    log_chat_messages,
    wrap_quoted_user_message,
)
from app.services.references import reference_block_for_texts, with_references


def _conversation_with_quote(
    messages: list[ChatMessage], quoted: str | None, *, locale: PromptLocale
) -> list[dict[str, str]]:
    """Convert chat history to API messages, attaching a quote to the last user turn."""
    last_user_index = next(
        (index for index in range(len(messages) - 1, -1, -1) if messages[index].role == "user"),
        None,
    )
    result: list[dict[str, str]] = []
    for index, message in enumerate(messages):
        content = message.content
        if index == last_user_index:
            content = wrap_quoted_user_message(message.content, quoted, locale=locale)
        result.append({"role": message.role, "content": content})
    return result


def _review_reference_texts(
    work: Work,
    chapter: Chapter | None,
    *,
    last_user: str,
    quoted: str | None,
) -> list[str]:
    """Collect source texts scanned for ``@`` references in the review flow."""
    texts = [work.summary or ""]
    if chapter is not None:
        texts.extend([chapter.summary or "", chapter.content or ""])
    texts.extend([last_user, quoted or ""])
    return texts


async def build_chat_messages(
    db: AsyncSession,
    work: Work,
    chapter: Chapter | None,
    payload: ChatRequest,
    system_prompt: str,
    *,
    locale: PromptLocale = "zh",
    extra_system: str | None = None,
) -> list[dict]:
    """Build the chat message list with work/chapter context and @ references."""
    last_user = next(
        (message.content for message in reversed(payload.messages) if message.role == "user"),
        "",
    )
    reference_block = await reference_block_for_texts(
        db,
        work.id,
        [last_user, payload.quoted or "", chapter.summary if chapter else ""],
        locale=locale,
    )
    context = with_references(
        build_chat_context_block(
            locale=locale,
            work_info=work_info_block(work, locale=locale),
            chapter_number=chapter.chapter_number if chapter else None,
            chapter_title=chapter.title if chapter else None,
            chapter_summary=chapter.summary if chapter else None,
            quoted=payload.quoted,
        ),
        reference_block,
    )
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    if extra_system:
        messages.append({"role": "system", "content": extra_system})
    messages.append({"role": "system", "content": context})
    messages.extend(
        {"role": message.role, "content": message.content} for message in payload.messages
    )
    return log_chat_messages("build_chat_messages", messages)


async def build_review_chat_messages(
    db: AsyncSession,
    work: Work,
    chapter: Chapter | None,
    payload: ChatRequest,
    system_prompt: str,
    review_instruction: str,
    *,
    locale: PromptLocale = "zh",
) -> list[dict]:
    """Build review chat messages with summary, outline, body, and @ references in system."""
    last_user = next(
        (message.content for message in reversed(payload.messages) if message.role == "user"),
        "",
    )
    reference_block = await reference_block_for_texts(
        db,
        work.id,
        _review_reference_texts(work, chapter, last_user=last_user, quoted=payload.quoted),
        locale=locale,
    )
    context = with_references(
        build_review_context_block(
            locale=locale,
            summary=work.summary,
            chapter_number=chapter.chapter_number if chapter else None,
            chapter_title=chapter.title if chapter else None,
            chapter_summary=chapter.summary if chapter else None,
            chapter_content=chapter.content if chapter else None,
        ),
        reference_block,
    )
    messages: list[dict] = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": review_instruction},
        {"role": "system", "content": context},
    ]
    messages.extend(_conversation_with_quote(payload.messages, payload.quoted, locale=locale))
    return log_chat_messages("build_review_chat_messages", messages)
