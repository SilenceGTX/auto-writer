"""Mount bundled frontend static assets for desktop (single-process) mode."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from loguru import logger


def mount_frontend(application: FastAPI, static_dir: Path) -> None:
    """Serve the Vite-built SPA from *static_dir* with HTML5 history fallback."""
    directory = static_dir.resolve()
    if not directory.is_dir():
        logger.warning("Frontend static directory not found: {}", directory)
        return

    index_html = directory / "index.html"
    if not index_html.is_file():
        logger.warning("Frontend index.html missing under {}", directory)
        return

    application.mount(
        "/",
        StaticFiles(directory=directory, html=True),
        name="frontend",
    )
    logger.info("已挂载前端静态资源 {}", directory)
