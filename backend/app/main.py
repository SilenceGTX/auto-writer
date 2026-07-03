"""FastAPI application entry point for the Auto-Writer backend."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.database import init_db
from app.frontend import mount_frontend
from app.routers import (
    export,
    health,
    inspirations,
    llm,
    outline,
    review,
    series,
    structures,
    works,
    worldbuilding,
    writing,
)
from app.routers import settings as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize application resources before serving requests."""
    await init_db()
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    cfg = get_settings()
    setup_logging(cfg.log_dir, cfg.log_level)
    logger.info("启动 {} 后端", cfg.app_name)
    application = FastAPI(title=cfg.app_name, version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health.router, prefix="/api")
    application.include_router(series.router, prefix="/api")
    application.include_router(structures.router, prefix="/api")
    application.include_router(works.router, prefix="/api")
    application.include_router(export.router, prefix="/api")
    application.include_router(outline.router, prefix="/api")
    application.include_router(writing.router, prefix="/api")
    application.include_router(review.router, prefix="/api")
    application.include_router(worldbuilding.router, prefix="/api")
    application.include_router(inspirations.router, prefix="/api")
    application.include_router(settings_router.router, prefix="/api")
    application.include_router(llm.router, prefix="/api")

    if cfg.static_dir:
        mount_frontend(application, Path(cfg.static_dir))

    return application


app = create_app()
