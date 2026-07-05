"""Persisted assistant chat history for the writing and review flows.

Stores conversation threads in SQLite keyed by work, assistant kind, and chapter.
Each thread keeps at most ``MAX_ASSISTANT_MESSAGES`` turns (user + assistant pairs
count as separate rows).
"""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AssistantConversation, AssistantMessage, Chapter, utcnow_iso
from app.schemas import ChatMessage, ChatMessageRead, ChatRequest

MAX_ASSISTANT_MESSAGES = 50


def chapter_key(chapter_id: int | None) -> int:
    """Normalize nullable chapter ids into a stable conversation lookup key."""
    return chapter_id if chapter_id is not None else 0


def format_user_message_for_llm(content: str, quoted: str | None) -> str:
    """Attach a stored quote block to a user message for LLM replay."""
    if quoted and quoted.strip():
        return f"【用户引用的片段】\n{quoted.strip()}\n\n【问题】\n{content}"
    return content


async def _validate_chapter(db: AsyncSession, work_id: int, chapter_id: int | None) -> None:
    """Ensure the chapter belongs to the work when a chapter id is provided."""
    if chapter_id is None:
        return
    chapter = await db.get(Chapter, chapter_id)
    if chapter is None or chapter.work_id != work_id:
        raise ValueError("Chapter not found")


async def get_or_create_conversation(
    db: AsyncSession,
    work_id: int,
    kind: str,
    chapter_id: int | None,
) -> AssistantConversation:
    """Return the conversation row for the given scope, creating it when missing."""
    key = chapter_key(chapter_id)
    result = await db.execute(
        select(AssistantConversation).where(
            AssistantConversation.work_id == work_id,
            AssistantConversation.kind == kind,
            AssistantConversation.chapter_key == key,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is not None:
        return conversation

    conversation = AssistantConversation(
        work_id=work_id,
        kind=kind,
        chapter_id=chapter_id,
        chapter_key=key,
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def load_stored_messages(db: AsyncSession, conversation_id: int) -> list[AssistantMessage]:
    """Return ordered persisted messages for a conversation."""
    result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.conversation_id == conversation_id)
        .order_by(AssistantMessage.sort_order)
    )
    return list(result.scalars())


async def list_conversation_messages(
    db: AsyncSession, work_id: int, kind: str, chapter_id: int | None
) -> list[ChatMessageRead]:
    """Load persisted messages for a conversation scope."""
    await _validate_chapter(db, work_id, chapter_id)
    key = chapter_key(chapter_id)
    result = await db.execute(
        select(AssistantConversation)
        .options(selectinload(AssistantConversation.messages))
        .where(
            AssistantConversation.work_id == work_id,
            AssistantConversation.kind == kind,
            AssistantConversation.chapter_key == key,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        return []
    return [_to_read(message) for message in conversation.messages]


async def clear_conversation(
    db: AsyncSession, work_id: int, kind: str, chapter_id: int | None
) -> None:
    """Delete all messages in the conversation for the given scope."""
    await _validate_chapter(db, work_id, chapter_id)
    key = chapter_key(chapter_id)
    result = await db.execute(
        select(AssistantConversation.id).where(
            AssistantConversation.work_id == work_id,
            AssistantConversation.kind == kind,
            AssistantConversation.chapter_key == key,
        )
    )
    conversation_id = result.scalar_one_or_none()
    if conversation_id is None:
        return
    await db.execute(
        delete(AssistantMessage).where(AssistantMessage.conversation_id == conversation_id)
    )
    conversation = await db.get(AssistantConversation, conversation_id)
    if conversation is not None:
        conversation.updated_at = utcnow_iso()


def build_chat_request(
    stored: list[AssistantMessage],
    *,
    content: str,
    chapter_id: int | None,
    quoted: str | None,
) -> ChatRequest:
    """Build a chat request from persisted history plus the new user turn."""
    messages: list[ChatMessage] = []
    for message in stored:
        body = message.content
        if message.role == "user":
            body = format_user_message_for_llm(message.content, message.quoted)
        messages.append(ChatMessage(role=message.role, content=body))
    messages.append(ChatMessage(role="user", content=content))
    return ChatRequest(messages=messages, chapter_id=chapter_id, quoted=quoted)


async def append_exchange(
    db: AsyncSession,
    conversation: AssistantConversation,
    *,
    user_content: str,
    user_quoted: str | None,
    assistant_content: str,
) -> list[ChatMessageRead]:
    """Persist a user/assistant exchange and enforce the history cap."""
    next_order = await db.scalar(
        select(func.coalesce(func.max(AssistantMessage.sort_order), 0)).where(
            AssistantMessage.conversation_id == conversation.id
        )
    )
    order = int(next_order or 0)
    now = utcnow_iso()
    db.add_all(
        [
            AssistantMessage(
                conversation_id=conversation.id,
                role="user",
                content=user_content,
                quoted=user_quoted,
                sort_order=order + 1,
                created_at=now,
            ),
            AssistantMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=assistant_content,
                quoted=None,
                sort_order=order + 2,
                created_at=now,
            ),
        ]
    )
    conversation.updated_at = now
    await db.flush()
    await _trim_conversation(db, conversation.id)
    result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.conversation_id == conversation.id)
        .order_by(AssistantMessage.sort_order)
    )
    return [_to_read(message) for message in result.scalars()]


async def _trim_conversation(db: AsyncSession, conversation_id: int) -> None:
    """Keep only the most recent ``MAX_ASSISTANT_MESSAGES`` rows."""
    result = await db.execute(
        select(AssistantMessage.id)
        .where(AssistantMessage.conversation_id == conversation_id)
        .order_by(AssistantMessage.sort_order.desc())
        .offset(MAX_ASSISTANT_MESSAGES)
    )
    stale_ids = list(result.scalars())
    if not stale_ids:
        return
    await db.execute(delete(AssistantMessage).where(AssistantMessage.id.in_(stale_ids)))


def _to_read(message: AssistantMessage) -> ChatMessageRead:
    """Serialize a persisted assistant message for the API."""
    return ChatMessageRead(
        id=message.id,
        role=message.role,
        content=message.content,
        quoted=message.quoted,
        created_at=message.created_at,
    )
