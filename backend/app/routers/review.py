"""Review page backend: AI review chat over a work's chapters.

Implements ``designs/REVIEW_PAGE_DESIGN.md`` §3: the user reads the finished
manuscript and can quote a passage to ask the AI (acting as an editor) to check
it and suggest improvements. The reader itself reuses the existing outline and
chapter-content read endpoints; this router only adds the review chat, reusing
the shared LLM context, chat-message assembly, and ``@`` reference injection.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Chapter
from app.schemas import ChatReply, ChatRequest
from app.services.chat_service import build_review_chat_messages
from app.services.generation_context import load_work_with_structure, resolve_llm_context
from app.services.llm_service import LLMConfigError, LLMRequestError, chat_completion
from app.services.prompts import build_review_instruction

router = APIRouter(tags=["review"])


@router.post("/works/{work_id}/review/chat", response_model=ChatReply)
async def review_chat(
    work_id: int, payload: ChatRequest, db: AsyncSession = Depends(get_db)
) -> ChatReply:
    """Answer a review question with work/chapter context and the quoted passage."""
    work = await load_work_with_structure(db, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")
    chapter = await db.get(Chapter, payload.chapter_id) if payload.chapter_id else None

    try:
        connection, system_prompt, params = await resolve_llm_context(db, "writing")
        messages = await build_review_chat_messages(
            db, work, chapter, payload, system_prompt, build_review_instruction()
        )
        reply = await chat_completion(connection, messages, params)
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMRequestError as exc:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{exc}") from exc

    return ChatReply(reply=reply.strip())
