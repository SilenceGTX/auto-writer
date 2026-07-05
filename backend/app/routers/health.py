"""Health check routes for service readiness checks."""

from fastapi import APIRouter

from app.core import settings
from app.core.build_info import load_build_info
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return basic service health information."""
    build = load_build_info()
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=build.get("version"),
        git_commit=build.get("git_commit"),
        built_at=build.get("built_at"),
    )
