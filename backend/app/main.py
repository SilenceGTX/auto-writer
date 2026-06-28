"""FastAPI application entry point for the Auto-Writer backend."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.core import settings, setup_logging
from app.database import init_db
from app.routers import (
    health,
    inspirations,
    llm,
    outline,
    series,
    structures,
    works,
    worldbuilding,
)
from app.routers import settings as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize application resources before serving requests."""
    await init_db()
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    setup_logging(settings.log_dir, settings.log_level)
    logger.info("启动 {} 后端", settings.app_name)
    application = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health.router, prefix="/api")
    application.include_router(series.router, prefix="/api")
    application.include_router(structures.router, prefix="/api")
    application.include_router(works.router, prefix="/api")
    application.include_router(outline.router, prefix="/api")
    application.include_router(worldbuilding.router, prefix="/api")
    application.include_router(inspirations.router, prefix="/api")
    application.include_router(settings_router.router, prefix="/api")
    application.include_router(llm.router, prefix="/api")
    return application


app = create_app()
