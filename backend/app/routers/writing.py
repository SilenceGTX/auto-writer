"""Writing page backend: chapter body editing and AI collaboration.

Implements ``designs/WRITING_PAGE_DESSIGN.md``: save chapter body text with word
recount and ``works.total_word_count`` aggregation; generate a chapter draft from
its outline; the 前情提要 (recap) cache for the previous chapter with staleness
detection; local rewrite of a selected passage (returned for a diff preview, not
persisted); and the writing-assistant chat. AI calls reuse the LLM service and
inject ``@``-referenced setting entries (G4).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Chapter, Work, utcnow_iso
from app.schemas import (
    ChapterContentRead,
    ChapterContentUpdate,
    ChatReply,
    ChatRequest,
    DraftGenerateRequest,
    RecapRead,
    RewriteRequest,
    RewriteResult,
)
from app.services.chat_service import build_chat_messages
from app.services.generation_context import (
    load_work_with_structure,
    resolve_llm_context,
    work_info_block,
)
from app.services.llm_service import LLMConfigError, LLMRequestError, chat_completion
from app.services.prompts import (
    build_draft_prompt,
    build_recap_prompt,
    build_rewrite_prompt,
)
from app.services.references import reference_block_for_texts, with_references
from app.services.writing_service import count_words

router = APIRouter(tags=["writing"])


async def _get_chapter(db: AsyncSession, chapter_id: int) -> Chapter:
    """Load a chapter by id or raise 404."""
    chapter = await db.get(Chapter, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


async def _get_work(db: AsyncSession, work_id: int) -> Work:
    """Load a work with its structure relationship or raise 404."""
    work = await load_work_with_structure(db, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")
    return work


async def _previous_chapter(db: AsyncSession, chapter: Chapter) -> Chapter | None:
    """Return the chapter immediately preceding the given one, if any."""
    result = await db.execute(
        select(Chapter)
        .where(
            Chapter.work_id == chapter.work_id,
            Chapter.chapter_number < chapter.chapter_number,
        )
        .order_by(Chapter.chapter_number.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _summarize_and_cache_recap(
    db: AsyncSession, previous: Chapter, connection, system_prompt: str, params
) -> str:
    """Summarize a chapter's content, cache the recap on it, and return the text.

    Mutates ``previous`` in place (recap + timestamps); the caller is responsible
    for committing. Shared by the recap endpoint and the draft generator.
    """
    user_prompt = build_recap_prompt(
        chapter_number=previous.chapter_number,
        title=previous.title,
        content=previous.content or "",
    )
    recap = await chat_completion(
        connection,
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        params,
    )
    # Pin recap_generated_at to updated_at so a freshly generated recap is not
    # considered stale; a later content edit bumps updated_at and marks it stale.
    now = utcnow_iso()
    previous.recap = recap.strip()
    previous.recap_generated_at = now
    previous.updated_at = now
    return previous.recap


async def _recompute_work_total(db: AsyncSession, work_id: int) -> None:
    """Recompute and store a work's aggregate word count from its chapters."""
    total = await db.scalar(
        select(func.coalesce(func.sum(Chapter.word_count), 0)).where(Chapter.work_id == work_id)
    )
    work = await db.get(Work, work_id)
    if work is not None:
        work.total_word_count = int(total or 0)


def _config_error(exc: Exception) -> HTTPException:
    """Map an LLM config error to a 400 response."""
    return HTTPException(status_code=400, detail=str(exc))


def _request_error(exc: Exception) -> HTTPException:
    """Map an LLM request/parse error to a 502 response."""
    return HTTPException(status_code=502, detail=f"AI 调用失败：{exc}")


@router.get("/chapters/{chapter_id}", response_model=ChapterContentRead)
async def get_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)) -> ChapterContentRead:
    """Return a chapter's full payload (including body text) for the editor."""
    return ChapterContentRead.model_validate(await _get_chapter(db, chapter_id))


@router.put("/chapters/{chapter_id}/content", response_model=ChapterContentRead)
async def save_chapter_content(
    chapter_id: int, payload: ChapterContentUpdate, db: AsyncSession = Depends(get_db)
) -> ChapterContentRead:
    """Save a chapter's body, recompute its word count and the work total."""
    chapter = await _get_chapter(db, chapter_id)
    chapter.content = payload.content
    chapter.word_count = count_words(payload.content)
    await db.flush()
    await _recompute_work_total(db, chapter.work_id)
    await db.commit()
    await db.refresh(chapter)
    return ChapterContentRead.model_validate(chapter)


@router.post("/chapters/{chapter_id}/draft:generate", response_model=ChapterContentRead)
async def generate_draft(
    chapter_id: int, payload: DraftGenerateRequest, db: AsyncSession = Depends(get_db)
) -> ChapterContentRead:
    """Generate the chapter body from its outline (and optionally the recap)."""
    chapter = await _get_chapter(db, chapter_id)
    work = await _get_work(db, chapter.work_id)

    try:
        connection, system_prompt, params = await resolve_llm_context(db, "writing")

        # When requested, include the previous chapter's recap. Reuse the cached
        # recap if present; otherwise generate one now (and cache it) as long as
        # the previous chapter has body text to summarize.
        recap_text = None
        if payload.include_recap:
            previous = await _previous_chapter(db, chapter)
            if previous is not None:
                if previous.recap and previous.recap.strip():
                    recap_text = previous.recap
                elif (previous.content or "").strip():
                    recap_text = await _summarize_and_cache_recap(
                        db, previous, connection, system_prompt, params
                    )

        reference_block = await reference_block_for_texts(
            db, chapter.work_id, [chapter.summary or ""]
        )
        user_prompt = with_references(
            build_draft_prompt(
                work_info_block(work),
                chapter_number=chapter.chapter_number,
                title=chapter.title,
                summary=chapter.summary,
                recap=recap_text,
            ),
            reference_block,
        )
        content = await chat_completion(
            connection,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            params,
        )
    except LLMConfigError as exc:
        raise _config_error(exc) from exc
    except LLMRequestError as exc:
        raise _request_error(exc) from exc

    chapter.content = content.strip()
    chapter.word_count = count_words(chapter.content)
    await db.flush()
    await _recompute_work_total(db, chapter.work_id)
    await db.commit()
    await db.refresh(chapter)
    logger.info("生成章节正文 chapter_id={} 字数={}", chapter_id, chapter.word_count)
    return ChapterContentRead.model_validate(chapter)


@router.get("/chapters/{chapter_id}/recap", response_model=RecapRead)
async def get_recap(chapter_id: int, db: AsyncSession = Depends(get_db)) -> RecapRead:
    """Return the previous chapter's cached recap and whether it is stale."""
    chapter = await _get_chapter(db, chapter_id)
    previous = await _previous_chapter(db, chapter)
    if previous is None:
        return RecapRead(has_previous=False)
    if not previous.recap:
        return RecapRead(
            has_previous=True, previous_chapter_number=previous.chapter_number, cached=False
        )
    stale = (previous.recap_generated_at or "") < (previous.updated_at or "")
    return RecapRead(
        has_previous=True,
        previous_chapter_number=previous.chapter_number,
        recap=previous.recap,
        cached=True,
        stale=stale,
    )


@router.post("/chapters/{chapter_id}/recap:generate", response_model=RecapRead)
async def generate_recap(chapter_id: int, db: AsyncSession = Depends(get_db)) -> RecapRead:
    """Summarize the previous chapter and cache the recap on it."""
    chapter = await _get_chapter(db, chapter_id)
    previous = await _previous_chapter(db, chapter)
    if previous is None:
        raise HTTPException(status_code=400, detail="当前章节没有前一章节")
    if not (previous.content or "").strip():
        raise HTTPException(status_code=400, detail="前一章节尚无正文，无法生成前情提要")

    try:
        connection, system_prompt, params = await resolve_llm_context(db, "writing")
        recap_text = await _summarize_and_cache_recap(
            db, previous, connection, system_prompt, params
        )
    except LLMConfigError as exc:
        raise _config_error(exc) from exc
    except LLMRequestError as exc:
        raise _request_error(exc) from exc

    await db.commit()
    logger.info("生成前情提要 previous_chapter_id={}", previous.id)
    return RecapRead(
        has_previous=True,
        previous_chapter_number=previous.chapter_number,
        recap=recap_text,
        cached=True,
        stale=False,
    )


@router.post("/chapters/{chapter_id}/rewrite", response_model=RewriteResult)
async def rewrite_passage(
    chapter_id: int, payload: RewriteRequest, db: AsyncSession = Depends(get_db)
) -> RewriteResult:
    """Rewrite a selected passage and return original + new for a diff preview."""
    chapter = await _get_chapter(db, chapter_id)
    try:
        connection, system_prompt, params = await resolve_llm_context(db, "writing")
        reference_block = await reference_block_for_texts(
            db,
            chapter.work_id,
            [
                payload.selection,
                payload.context or "",
                payload.preceding or "",
                payload.following or "",
                chapter.summary or "",
            ],
        )
        user_prompt = with_references(
            build_rewrite_prompt(
                selection=payload.selection,
                instruction=payload.instruction,
                context=payload.context,
                preceding=payload.preceding,
                following=payload.following,
            ),
            reference_block,
        )
        rewritten = await chat_completion(
            connection,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            params,
        )
    except LLMConfigError as exc:
        raise _config_error(exc) from exc
    except LLMRequestError as exc:
        raise _request_error(exc) from exc

    return RewriteResult(original=payload.selection, rewritten=rewritten.strip())


@router.post("/works/{work_id}/chat", response_model=ChatReply)
async def writing_chat(
    work_id: int, payload: ChatRequest, db: AsyncSession = Depends(get_db)
) -> ChatReply:
    """Answer the writing-assistant chat with work/chapter context and references."""
    work = await _get_work(db, work_id)
    chapter = await db.get(Chapter, payload.chapter_id) if payload.chapter_id else None

    try:
        connection, system_prompt, params = await resolve_llm_context(db, "writing")
        messages = await build_chat_messages(db, work, chapter, payload, system_prompt)
        reply = await chat_completion(connection, messages, params)
    except LLMConfigError as exc:
        raise _config_error(exc) from exc
    except LLMRequestError as exc:
        raise _request_error(exc) from exc

    return ChatReply(reply=reply.strip())


@router.get("/works/{work_id}/word-count", status_code=status.HTTP_200_OK)
async def get_word_count(work_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Return the work's aggregated word count (and planned target if set)."""
    work = await _get_work(db, work_id)
    return {"total_word_count": work.total_word_count}
