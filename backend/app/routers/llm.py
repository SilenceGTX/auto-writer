"""Routes for LLM connectivity (connection testing).

Outline/writing generation endpoints that reuse the LLM service are added in
later phases; Phase 2 exposes the connection test used by system settings.
"""

from fastapi import APIRouter
from loguru import logger

from app.schemas import ConnectionTestResult, LLMProfile
from app.services.llm_service import (
    LLMConfigError,
    LLMConnection,
    LLMRequestError,
    test_connection,
)

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/test", response_model=ConnectionTestResult)
async def test_llm_connection(payload: LLMProfile) -> ConnectionTestResult:
    """Test the supplied LLM profile with a lightweight completion."""
    try:
        connection = LLMConnection.from_profile(payload.model_dump())
        sample = await test_connection(connection)
        logger.info("连接 LLM 成功 profile_id={} model={}", payload.id, payload.model)
        return ConnectionTestResult(ok=True, code="success", sample=sample[:200])
    except (LLMConfigError, LLMRequestError) as exc:
        logger.warning("连接 LLM 测试失败：{}", exc)
        return ConnectionTestResult(ok=False, code=exc.code, detail=exc.detail)
