"""Outline page backend: stages, chapters, AI generation, and reordering.

Implements ``designs/OUTLINE_PAGE_DESIGN.md``: stage tree with synopses (总纲),
chapter outlines, AI generation of both (OpenAI-compatible via the LLM service),
chapter add / update / delete / reorder, per-stage chapter-count adjustment, and
outline locking via ``works.actual_chapter_count``.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps.locale import PromptLocale, get_request_locale
from app.models import Chapter, Work, WorkStage
from app.schemas import (
    ChapterCreate,
    ChapterRead,
    ChapterReorderRequest,
    ChapterUpdate,
    OutlineRead,
    StageChapterCountUpdate,
    WorkStageRead,
    WorkStageUpdate,
)
from app.services.generation_context import resolve_llm_context, work_info_block
from app.services.llm_service import LLMConfigError, LLMRequestError, chat_completion
from app.services.outline_service import allocate_chapter_counts, extract_json
from app.services.prompts import (
    build_chapter_generation_prompt,
    build_stage_generation_prompt,
)
from app.services.references import reference_block_for_texts, with_references
from app.services.story_structure_i18n import index_stage_generation_results

router = APIRouter(tags=["outline"])

_MAX_STAGE_CHAPTERS = 200


async def _get_work(db: AsyncSession, work_id: int) -> Work:
    """Load a work with its structure relationship or raise 404."""
    result = await db.execute(
        select(Work).options(selectinload(Work.structure)).where(Work.id == work_id)
    )
    work = result.scalar_one_or_none()
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")
    return work


async def _ordered_chapters(db: AsyncSession, work_id: int) -> list[Chapter]:
    """Return a work's chapters ordered by chapter number."""
    result = await db.execute(
        select(Chapter)
        .where(Chapter.work_id == work_id)
        .order_by(Chapter.chapter_number, Chapter.id)
    )
    return list(result.scalars().all())


async def _ordered_stages(db: AsyncSession, work_id: int) -> list[WorkStage]:
    """Return a work's stages ordered by sort order."""
    result = await db.execute(
        select(WorkStage).where(WorkStage.work_id == work_id).order_by(WorkStage.sort_order)
    )
    return list(result.scalars().all())


async def _load_outline(db: AsyncSession, work_id: int) -> OutlineRead:
    """Build the aggregate outline payload for a work."""
    work = await _get_work(db, work_id)
    stages = await _ordered_stages(db, work_id)
    chapters = await _ordered_chapters(db, work_id)

    counts: dict[int | None, int] = {}
    for chapter in chapters:
        counts[chapter.stage_id] = counts.get(chapter.stage_id, 0) + 1

    return OutlineRead(
        work_id=work.id,
        title=work.title,
        planned_chapter_count=work.planned_chapter_count,
        actual_chapter_count=work.actual_chapter_count,
        structure_name=work.structure.name if work.structure else None,
        locked=work.actual_chapter_count is not None,
        stages=[
            WorkStageRead(
                id=stage.id,
                work_id=stage.work_id,
                name=stage.name,
                overview=stage.overview,
                sort_order=stage.sort_order,
                chapter_count=counts.get(stage.id, 0),
            )
            for stage in stages
        ],
        chapters=[ChapterRead.model_validate(chapter) for chapter in chapters],
    )


async def _renumber_by_stage(db: AsyncSession, work_id: int) -> None:
    """Renumber chapters grouped by stage order (unassigned chapters last)."""
    stages = await _ordered_stages(db, work_id)
    stage_rank = {stage.id: index for index, stage in enumerate(stages)}
    chapters = await _ordered_chapters(db, work_id)
    chapters.sort(
        key=lambda chapter: (
            stage_rank.get(chapter.stage_id, len(stages)),
            chapter.chapter_number,
            chapter.id,
        )
    )
    for index, chapter in enumerate(chapters, start=1):
        chapter.chapter_number = index


async def _renumber_contiguous(db: AsyncSession, work_id: int) -> None:
    """Reassign contiguous chapter numbers following the current order."""
    for index, chapter in enumerate(await _ordered_chapters(db, work_id), start=1):
        chapter.chapter_number = index


@router.get("/works/{work_id}/outline", response_model=OutlineRead)
async def get_outline(work_id: int, db: AsyncSession = Depends(get_db)) -> OutlineRead:
    """Return the full outline (stages + chapters) for a work."""
    await _get_work(db, work_id)
    return await _load_outline(db, work_id)


@router.post("/works/{work_id}/outline/stages:generate", response_model=OutlineRead)
async def generate_stages(
    work_id: int,
    db: AsyncSession = Depends(get_db),
    locale: PromptLocale = Depends(get_request_locale),
) -> OutlineRead:
    """Generate the stage tree and synopses, replacing any existing outline."""
    work = await _get_work(db, work_id)
    structure = work.structure
    stage_names = json.loads(structure.stages) if structure else []
    if not stage_names:
        raise HTTPException(status_code=400, detail="请先为作品选择包含阶段的故事结构")

    try:
        connection, system_prompt, params = await resolve_llm_context(
            db, "outline_stages", locale=locale
        )
        reference_block = await reference_block_for_texts(
            db, work_id, [work.summary or ""], locale=locale
        )
        user_prompt = with_references(
            build_stage_generation_prompt(
                work_info_block(work, locale=locale),
                stage_names,
                work.planned_chapter_count,
                structure_name=structure.name if structure else None,
                locale=locale,
            ),
            reference_block,
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        content = await chat_completion(connection, messages, params, task="outline_stages")
        parsed = extract_json(content)
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (LLMRequestError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"AI 生成失败：{exc}") from exc

    by_name = index_stage_generation_results(parsed, structure.name if structure else None)
    fallback = allocate_chapter_counts(
        len(stage_names), work.planned_chapter_count or len(stage_names)
    )

    await db.execute(delete(Chapter).where(Chapter.work_id == work_id))
    await db.execute(delete(WorkStage).where(WorkStage.work_id == work_id))
    await db.flush()

    chapter_number = 1
    for index, name in enumerate(stage_names):
        item = by_name.get(name, {})
        try:
            count = int(item.get("chapter_count"))
        except (TypeError, ValueError):
            count = fallback[index]
        count = max(0, min(count, _MAX_STAGE_CHAPTERS))
        stage = WorkStage(
            work_id=work_id, name=name, overview=item.get("overview"), sort_order=index
        )
        db.add(stage)
        await db.flush()
        for _ in range(count):
            db.add(Chapter(work_id=work_id, stage_id=stage.id, chapter_number=chapter_number))
            chapter_number += 1

    work.actual_chapter_count = None
    work.total_word_count = 0
    await db.commit()
    logger.info("生成阶段树 work_id={} 阶段数={}", work_id, len(stage_names))
    return await _load_outline(db, work_id)


@router.post("/works/{work_id}/outline/chapters:generate", response_model=OutlineRead)
async def generate_chapter_outlines(
    work_id: int,
    db: AsyncSession = Depends(get_db),
    locale: PromptLocale = Depends(get_request_locale),
) -> OutlineRead:
    """Generate per-chapter titles and summaries, then lock the outline."""
    work = await _get_work(db, work_id)
    stages = await _ordered_stages(db, work_id)
    chapters = await _ordered_chapters(db, work_id)
    if not chapters:
        raise HTTPException(status_code=400, detail="请先生成阶段树并分配章节")

    expected_numbers = [c.chapter_number for c in chapters]
    logger.debug(
        "生成章节大纲开始 work_id={} locale={} 阶段数={} 章节数={} 编号={}",
        work_id,
        locale,
        len(stages),
        len(chapters),
        expected_numbers,
    )

    stage_payload: list[dict[str, object]] = []
    for stage in stages:
        numbers = [c.chapter_number for c in chapters if c.stage_id == stage.id]
        stage_payload.append(
            {"name": stage.name, "overview": stage.overview, "chapter_numbers": numbers}
        )
        logger.debug(
            "生成章节大纲阶段 payload name={!r} 章节={} overview_len={}",
            stage.name,
            numbers,
            len(stage.overview or ""),
        )

    content = ""
    try:
        connection, system_prompt, params = await resolve_llm_context(
            db, "outline_chapters", locale=locale
        )
        logger.debug(
            "生成章节大纲 LLM 上下文 profile_id={} model={} params_keys={}",
            connection.profile_id or "-",
            connection.model or "(default)",
            sorted(params.keys()) if isinstance(params, dict) else type(params).__name__,
        )
        texts = [work.summary or ""] + [stage.overview or "" for stage in stages]
        reference_block = await reference_block_for_texts(db, work_id, texts, locale=locale)
        logger.debug(
            "生成章节大纲引用块长度={} 扫描文本段数={}",
            len(reference_block),
            len(texts),
        )
        user_prompt = with_references(
            build_chapter_generation_prompt(
                work_info_block(work, locale=locale),
                stage_payload,
                expected_numbers,
                structure_name=work.structure.name if work.structure else None,
                locale=locale,
            ),
            reference_block,
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        content = await chat_completion(connection, messages, params, task="outline_chapters")
        logger.debug(
            "生成章节大纲 LLM 原始响应 len={} preview=\n{}",
            len(content),
            content[:800],
        )
        parsed = extract_json(content)
    except LLMConfigError as exc:
        logger.debug("生成章节大纲失败（配置） work_id={} error={}", work_id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (LLMRequestError, ValueError) as exc:
        logger.debug(
            "生成章节大纲失败（请求/解析） work_id={} error_type={} error={} "
            "response_len={} response_preview=\n{}",
            work_id,
            type(exc).__name__,
            exc,
            len(content),
            content[:800] if content else "(empty)",
        )
        raise HTTPException(status_code=502, detail=f"AI 生成失败：{exc}") from exc

    if not isinstance(parsed, list):
        logger.debug(
            "生成章节大纲：期望 JSON 数组，实际类型={} value_preview={!r}",
            type(parsed).__name__,
            str(parsed)[:400],
        )
        raise HTTPException(
            status_code=502,
            detail="AI 生成失败：无法从 LLM 响应中解析 JSON",
        )

    by_number: dict[int, dict] = {}
    skipped_items = 0
    for item in parsed:
        if not isinstance(item, dict):
            skipped_items += 1
            logger.debug("生成章节大纲：跳过非对象项 type={}", type(item).__name__)
            continue
        try:
            by_number[int(item.get("chapter_number"))] = item
        except (TypeError, ValueError):
            skipped_items += 1
            logger.debug(
                "生成章节大纲：跳过无效 chapter_number raw={!r} keys={}",
                item.get("chapter_number"),
                list(item.keys()),
            )
            continue

    returned_numbers = sorted(by_number.keys())
    missing = [number for number in expected_numbers if number not in by_number]
    unexpected = [number for number in returned_numbers if number not in expected_numbers]
    logger.debug(
        "生成章节大纲解析结果 returned={} missing={} unexpected={} skipped_items={}",
        returned_numbers,
        missing,
        unexpected,
        skipped_items,
    )

    updated = 0
    for chapter in chapters:
        item = by_number.get(chapter.chapter_number)
        if item is None:
            continue
        chapter.title = item.get("title") or chapter.title
        chapter.summary = item.get("summary") or chapter.summary
        updated += 1

    work.actual_chapter_count = len(chapters)
    await db.commit()
    logger.info(
        "生成章节大纲 work_id={} 章节数={} 已更新={}",
        work_id,
        len(chapters),
        updated,
    )
    return await _load_outline(db, work_id)


@router.patch("/stages/{stage_id}", response_model=WorkStageRead)
async def update_stage(
    stage_id: int, payload: WorkStageUpdate, db: AsyncSession = Depends(get_db)
) -> WorkStageRead:
    """Update a stage's name and/or synopsis."""
    stage = await db.get(WorkStage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    await db.commit()
    count = await db.scalar(
        select(func.count()).select_from(Chapter).where(Chapter.stage_id == stage_id)
    )
    return WorkStageRead(
        id=stage.id,
        work_id=stage.work_id,
        name=stage.name,
        overview=stage.overview,
        sort_order=stage.sort_order,
        chapter_count=int(count or 0),
    )


@router.put("/stages/{stage_id}/chapter-count", response_model=OutlineRead)
async def set_stage_chapter_count(
    stage_id: int, payload: StageChapterCountUpdate, db: AsyncSession = Depends(get_db)
) -> OutlineRead:
    """Adjust how many chapters belong to a stage by adding/removing empties."""
    stage = await db.get(WorkStage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")

    result = await db.execute(
        select(Chapter)
        .where(Chapter.stage_id == stage_id)
        .order_by(Chapter.chapter_number, Chapter.id)
    )
    current = list(result.scalars().all())

    if payload.count > len(current):
        for _ in range(payload.count - len(current)):
            db.add(Chapter(work_id=stage.work_id, stage_id=stage_id, chapter_number=0))
    else:
        removable = [c for c in reversed(current) if not (c.content or "").strip()]
        for chapter in removable[: len(current) - payload.count]:
            await db.delete(chapter)

    await db.flush()
    await _renumber_by_stage(db, stage.work_id)
    await db.commit()
    return await _load_outline(db, stage.work_id)


@router.post(
    "/works/{work_id}/chapters", response_model=ChapterRead, status_code=status.HTTP_201_CREATED
)
async def add_chapter(
    work_id: int, payload: ChapterCreate, db: AsyncSession = Depends(get_db)
) -> ChapterRead:
    """Append a chapter to a work (placed last, optionally within a stage)."""
    await _get_work(db, work_id)
    max_number = await db.scalar(
        select(func.max(Chapter.chapter_number)).where(Chapter.work_id == work_id)
    )
    chapter = Chapter(
        work_id=work_id,
        stage_id=payload.stage_id,
        chapter_number=int(max_number or 0) + 1,
        title=payload.title,
        summary=payload.summary,
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return ChapterRead.model_validate(chapter)


@router.patch("/chapters/{chapter_id}", response_model=ChapterRead)
async def update_chapter(
    chapter_id: int, payload: ChapterUpdate, db: AsyncSession = Depends(get_db)
) -> ChapterRead:
    """Update a chapter's outline fields (title, summary, status, stage)."""
    chapter = await db.get(Chapter, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")

    data = payload.model_dump(exclude_unset=True)
    stage_changed = "stage_id" in data and data["stage_id"] != chapter.stage_id
    for field, value in data.items():
        setattr(chapter, field, value)

    if stage_changed:
        # Move the chapter to the end of its new stage's chapter block so a
        # chapter reassigned to an earlier stage is grouped there, not left last.
        max_number = await db.scalar(
            select(func.max(Chapter.chapter_number)).where(Chapter.work_id == chapter.work_id)
        )
        chapter.chapter_number = int(max_number or 0) + 1
        await db.flush()
        await _renumber_by_stage(db, chapter.work_id)

    await db.commit()
    await db.refresh(chapter)
    return ChapterRead.model_validate(chapter)


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a chapter and renumber the remaining chapters contiguously."""
    chapter = await db.get(Chapter, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    work_id = chapter.work_id
    await db.delete(chapter)
    await db.flush()
    await _renumber_contiguous(db, work_id)
    await db.commit()


@router.put("/works/{work_id}/chapters/reorder", response_model=OutlineRead)
async def reorder_chapters(
    work_id: int, payload: ChapterReorderRequest, db: AsyncSession = Depends(get_db)
) -> OutlineRead:
    """Apply a new chapter order (and stage assignment) from a drag operation."""
    await _get_work(db, work_id)
    chapters = {c.id: c for c in await _ordered_chapters(db, work_id)}
    for position, item in enumerate(payload.items, start=1):
        chapter = chapters.get(item.id)
        if chapter is None:
            raise HTTPException(status_code=400, detail="章节不属于该作品")
        chapter.chapter_number = position
        chapter.stage_id = item.stage_id
    await db.commit()
    return await _load_outline(db, work_id)
