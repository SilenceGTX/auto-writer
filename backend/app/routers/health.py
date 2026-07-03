"""Health check routes for service readiness checks."""

from fastapi import APIRouter

from app.core import settings
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return basic service health information."""
    return HealthResponse(status="ok", app_name=settings.app_name)
