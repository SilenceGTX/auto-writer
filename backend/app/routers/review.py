"""Review page backend: AI review chat over a work's chapters.

Implements ``designs/REVIEW_PAGE_DESIGN.md`` §3: the user reads the finished
manuscript and can quote a passage to ask the AI (acting as an editor) to check
it and suggest improvements. The reader itself reuses the existing outline and
chapter-content read endpoints; this router adds persisted review chat, reusing
the shared LLM context, chat-message assembly, and ``@`` reference injection.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps.locale import PromptLocale, get_request_locale
from app.models import Chapter
from app.schemas import ChatHistoryResponse, ChatSendRequest, ChatSendResponse
from app.services.assistant_conversation_service import (
    append_exchange,
    build_chat_request,
    clear_conversation,
    get_or_create_conversation,
    list_conversation_messages,
    load_stored_messages,
)
from app.services.chat_service import build_review_chat_messages
from app.services.generation_context import load_work_with_structure, resolve_llm_context
from app.services.llm_service import LLMConfigError, LLMRequestError, chat_completion
from app.services.prompts import build_review_instruction

router = APIRouter(tags=["review"])


@router.get("/works/{work_id}/review/chat/messages", response_model=ChatHistoryResponse)
async def get_review_chat_messages(
    work_id: int,
    chapter_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> ChatHistoryResponse:
    """Return persisted review-assistant messages for a work/chapter scope."""
    work = await load_work_with_structure(db, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")
    try:
        messages = await list_conversation_messages(db, work_id, "review", chapter_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ChatHistoryResponse(messages=messages)


@router.delete(
    "/works/{work_id}/review/chat/messages",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def clear_review_chat_messages(
    work_id: int,
    chapter_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Clear persisted review-assistant messages for a work/chapter scope."""
    work = await load_work_with_structure(db, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")
    try:
        await clear_conversation(db, work_id, "review", chapter_id)
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/works/{work_id}/review/chat", response_model=ChatSendResponse)
async def review_chat(
    work_id: int,
    payload: ChatSendRequest,
    db: AsyncSession = Depends(get_db),
    locale: PromptLocale = Depends(get_request_locale),
) -> ChatSendResponse:
    """Send a review-assistant turn, persist it, and return the model reply."""
    work = await load_work_with_structure(db, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")

    chapter = None
    if payload.chapter_id is not None:
        chapter = await db.get(Chapter, payload.chapter_id)
        if chapter is None or chapter.work_id != work.id:
            raise HTTPException(status_code=404, detail="Chapter not found")

    try:
        conversation = await get_or_create_conversation(
            db, work.id, "review", payload.chapter_id
        )
        stored = await load_stored_messages(db, conversation.id)
        chat_payload = build_chat_request(
            stored,
            content=payload.content,
            chapter_id=payload.chapter_id,
            quoted=payload.quoted,
        )
        connection, system_prompt, params = await resolve_llm_context(
            db, "review_chat", locale=locale
        )
        messages = await build_review_chat_messages(
            db,
            work,
            chapter,
            chat_payload,
            system_prompt,
            build_review_instruction(locale=locale),
            locale=locale,
        )
        reply = await chat_completion(connection, messages, params, task="review_chat")
        persisted = await append_exchange(
            db,
            conversation,
            user_content=payload.content,
            user_quoted=payload.quoted,
            assistant_content=reply.strip(),
        )
        await db.commit()
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMRequestError as exc:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{exc}") from exc

    return ChatSendResponse(reply=reply.strip(), messages=persisted)
