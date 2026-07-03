"""Routes for exporting a work and triggering filesystem snapshots.

Implements ``STORY_PAGE_DESIGN.md`` §2.5 (download a work as structured JSON or a
Markdown manuscript) and ``DATA_STORAGE_DESIGN.md`` §8.1 (write an auto-save
snapshot of a work to disk). Export files are written under ``data/exports/`` and
streamed back to the client as a download.
"""

import json
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Work
from app.services.export_service import (
    build_work_export_json,
    build_work_export_markdown,
    write_work_chapters_zip,
)
from app.services.snapshot_service import exports_dir, write_work_snapshot

router = APIRouter(prefix="/works", tags=["export"])


def _safe_filename(title: str) -> str:
    """Reduce a work title to a filesystem-safe slug for export filenames."""
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", title).strip().strip(".")
    return cleaned or "work"


@router.get("/{work_id}/export")
async def export_work(
    work_id: int,
    format: str = Query(default="json", pattern="^(json|md|chapters)$"),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Export a work as JSON, a single Markdown manuscript, or a chapter zip."""
    work = await db.get(Work, work_id)
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")

    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    slug = _safe_filename(work.title)
    target_dir = exports_dir()

    if format == "json":
        document = await build_work_export_json(db, work_id)
        body = json.dumps(document, ensure_ascii=False, indent=2)
        path = target_dir / f"{slug}-{timestamp}.json"
        media_type = "application/json"
        path.write_text(body, encoding="utf-8")
    elif format == "chapters":
        try:
            path, _count = await write_work_chapters_zip(
                db, work_id, target_dir, slug=slug, timestamp=timestamp
            )
        except ValueError as exc:
            if str(exc) == "Work not found":
                raise HTTPException(status_code=404, detail="Work not found") from exc
            raise HTTPException(status_code=400, detail="没有可导出的章节正文") from exc
        return FileResponse(path, media_type="application/zip", filename=f"{slug}.zip")
    else:
        body = await build_work_export_markdown(db, work_id) or ""
        path = target_dir / f"{slug}-{timestamp}.md"
        media_type = "text/markdown"
        path.write_text(body, encoding="utf-8")

    return FileResponse(path, media_type=media_type, filename=path.name)


@router.post("/{work_id}/snapshot")
async def snapshot_work(work_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Write an auto-save snapshot of the work to the configured snapshot path."""
    result = await db.execute(
        select(Work).options(selectinload(Work.stages)).where(Work.id == work_id)
    )
    work = result.scalar_one_or_none()
    if work is None:
        raise HTTPException(status_code=404, detail="Work not found")

    summary = await write_work_snapshot(db, work)
    return summary or {"snapshot_dir": None, "chapters": 0}
