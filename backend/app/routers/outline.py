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
from app.services.llm_service import (
    OUTLINE_TIMEOUT_SECONDS,
    LLMConfigError,
    LLMRequestError,
    chat_completion,
)
from app.services.outline_service import (
    CHAPTER_OUTLINE_MAX_ATTEMPTS,
    CHAPTER_OUTLINE_RESPONSE_FORMAT,
    allocate_chapter_counts,
    extract_chapter_outline_items,
    extract_json,
    index_chapter_outline_items,
    log_llm_parse_failure,
)
from app.services.prompts import (
    build_chapter_generation_prompt,
    build_stage_generation_prompt,
)
from app.services.references import reference_block_for_texts, with_references
from app.services.story_structure_i18n import (
    index_stage_generation_results,
    translate_preset_stage_name,
)

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

    content = ""
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
        content = await chat_completion(
            connection,
            messages,
            params,
            task="outline_stages",
            timeout_seconds=OUTLINE_TIMEOUT_SECONDS,
        )
        parsed = extract_json(content)
    except LLMConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMRequestError as exc:
        raise HTTPException(status_code=502, detail=f"AI 生成失败：{exc}") from exc
    except ValueError as exc:
        log_llm_parse_failure(context=f"生成阶段树 work_id={work_id}", content=content, error=exc)
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
    """Generate per-chapter titles and summaries stage-by-stage, then lock the outline."""
    work = await _get_work(db, work_id)
    stages = await _ordered_stages(db, work_id)
    chapters = await _ordered_chapters(db, work_id)
    if not chapters:
        raise HTTPException(status_code=400, detail="请先生成阶段树并分配章节")

    expected_numbers = [c.chapter_number for c in chapters]
    structure_name = work.structure.name if work.structure else None
    logger.debug(
        "生成章节大纲开始 work_id={} locale={} 阶段数={} 章节数={} 编号={}",
        work_id,
        locale,
        len(stages),
        len(chapters),
        expected_numbers,
    )

    stage_payload: list[dict[str, object]] = []
    stage_chapter_numbers: list[tuple[WorkStage, list[int]]] = []
    for stage in stages:
        numbers = [c.chapter_number for c in chapters if c.stage_id == stage.id]
        stage_payload.append(
            {"name": stage.name, "overview": stage.overview, "chapter_numbers": numbers}
        )
        stage_chapter_numbers.append((stage, numbers))
        logger.debug(
            "生成章节大纲阶段 payload name={!r} 章节={} overview_len={}",
            stage.name,
            numbers,
            len(stage.overview or ""),
        )

    by_number: dict[int, dict] = {}
    content = ""
    response_format: dict | None = CHAPTER_OUTLINE_RESPONSE_FORMAT
    try:
        connection, system_prompt, params = await resolve_llm_context(
            db, "outline_chapters", locale=locale
        )
        logger.debug(
            "生成章节大纲 LLM 上下文 profile_id={} model={} params_keys={} max_tokens={}",
            connection.profile_id or "-",
            connection.model or "(default)",
            sorted(params.keys()) if isinstance(params, dict) else type(params).__name__,
            params.get("max_tokens") if isinstance(params, dict) else None,
        )
        texts = [work.summary or ""] + [stage.overview or "" for stage in stages]
        reference_block = await reference_block_for_texts(db, work_id, texts, locale=locale)
        work_info = work_info_block(work, locale=locale, include_chapter_counts=False)
        logger.debug(
            "生成章节大纲引用块长度={} 扫描文本段数={}",
            len(reference_block),
            len(texts),
        )

        for stage, numbers in stage_chapter_numbers:
            if not numbers:
                logger.debug("生成章节大纲：跳过无章节阶段 name={!r}", stage.name)
                continue

            target_stage_name = translate_preset_stage_name(
                structure_name, stage.name, locale
            )
            user_prompt = with_references(
                build_chapter_generation_prompt(
                    work_info,
                    stage_payload,
                    numbers,
                    target_stage_name=target_stage_name,
                    structure_name=structure_name,
                    locale=locale,
                ),
                reference_block,
            )
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            stage_by_number: dict[int, dict] | None = None
            for attempt in range(1, CHAPTER_OUTLINE_MAX_ATTEMPTS + 1):
                logger.info(
                    "生成章节大纲阶段调用 work_id={} stage={!r} chapters={} count={} "
                    "attempt={}/{} response_format={}",
                    work_id,
                    stage.name,
                    numbers,
                    len(numbers),
                    attempt,
                    CHAPTER_OUTLINE_MAX_ATTEMPTS,
                    response_format,
                )
                try:
                    content = await chat_completion(
                        connection,
                        messages,
                        params,
                        task="outline_chapters",
                        timeout_seconds=OUTLINE_TIMEOUT_SECONDS,
                        response_format=response_format,
                    )
                except LLMRequestError as exc:
                    # Some OpenAI-compatible hosts reject response_format; fall back once.
                    if response_format is not None and exc.code == "http_error":
                        logger.warning(
                            "response_format 不被支持，改为普通补全重试 stage={!r} error={}",
                            stage.name,
                            exc,
                        )
                        response_format = None
                        content = await chat_completion(
                            connection,
                            messages,
                            params,
                            task="outline_chapters",
                            timeout_seconds=OUTLINE_TIMEOUT_SECONDS,
                            response_format=None,
                        )
                    else:
                        raise

                logger.debug(
                    "生成章节大纲阶段响应 stage={!r} attempt={} len={} finish_reason={} "
                    "usage={} preview=\n{}",
                    stage.name,
                    attempt,
                    len(content),
                    getattr(content, "finish_reason", None),
                    getattr(content, "usage", None),
                    content[:800],
                )
                try:
                    items = extract_chapter_outline_items(content)
                    indexed = index_chapter_outline_items(items, allowed_numbers=numbers)
                    missing = [number for number in numbers if number not in indexed]
                    if missing:
                        raise ValueError(
                            f"章节条数不足：需要 {len(numbers)} 章，"
                            f"有效 {len(indexed)} 章，missing={missing}"
                        )
                    stage_by_number = indexed
                    break
                except ValueError as exc:
                    log_llm_parse_failure(
                        context=(
                            f"生成章节大纲 work_id={work_id} stage={stage.name!r} "
                            f"attempt={attempt}/{CHAPTER_OUTLINE_MAX_ATTEMPTS}"
                        ),
                        content=content,
                        error=exc,
                    )
                    if attempt >= CHAPTER_OUTLINE_MAX_ATTEMPTS:
                        raise
                    logger.warning(
                        "生成章节大纲阶段将重试 stage={!r} attempt={}/{} error={}",
                        stage.name,
                        attempt,
                        CHAPTER_OUTLINE_MAX_ATTEMPTS,
                        exc,
                    )

            if stage_by_number is None:
                raise ValueError("无法从 LLM 响应中解析 JSON")
            by_number.update(stage_by_number)
    except LLMConfigError as exc:
        logger.debug("生成章节大纲失败（配置） work_id={} error={}", work_id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMRequestError as exc:
        logger.debug(
            "生成章节大纲失败（请求） work_id={} error_type={} error={}",
            work_id,
            type(exc).__name__,
            exc,
        )
        raise HTTPException(status_code=502, detail=f"AI 生成失败：{exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI 生成失败：{exc}") from exc

    returned_numbers = sorted(by_number.keys())
    missing = [number for number in expected_numbers if number not in by_number]
    unexpected = [number for number in returned_numbers if number not in expected_numbers]
    logger.debug(
        "生成章节大纲解析结果 returned={} missing={} unexpected={}",
        returned_numbers,
        missing,
        unexpected,
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
        "生成章节大纲 work_id={} 章节数={} 已更新={} 阶段调用数={}",
        work_id,
        len(chapters),
        updated,
        sum(1 for _, numbers in stage_chapter_numbers if numbers),
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
