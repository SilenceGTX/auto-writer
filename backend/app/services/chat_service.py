"""Shared assembly of writing / review assistant chat messages.

Both the writing assistant (``WRITING_PAGE_DESSIGN.md`` §3) and the review
assistant (``REVIEW_PAGE_DESIGN.md`` §3) drive an AI chat that needs the same
context: the 【作品信息】 block, the current chapter, an optional quoted passage,
and any ``@``-referenced setting entries (G4). This helper builds that message
list so the two routers do not duplicate the logic; routers only differ by the
preference stage and an optional extra system instruction.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter, Work
from app.schemas import ChatRequest
from app.services.generation_context import work_info_block
from app.services.prompts import build_chat_context_block
from app.services.references import reference_block_for_texts, with_references


async def build_chat_messages(
    db: AsyncSession,
    work: Work,
    chapter: Chapter | None,
    payload: ChatRequest,
    system_prompt: str,
    *,
    extra_system: str | None = None,
) -> list[dict]:
    """Build the chat message list with work/chapter context and @ references.

    ``extra_system`` is inserted as a second system message (used by the review
    assistant to frame the model as an editor) before the context block.
    """
    last_user = next(
        (message.content for message in reversed(payload.messages) if message.role == "user"),
        "",
    )
    reference_block = await reference_block_for_texts(
        db,
        work.id,
        [last_user, payload.quoted or "", chapter.summary if chapter else ""],
    )
    context = with_references(
        build_chat_context_block(
            work_info=work_info_block(work),
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
    return messages
