"""API routes for LLM-assisted writing operations."""

from fastapi import APIRouter

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/generate")
async def generate_text(prompt: str, context: str = ""):
    """Generate text using the configured LLM.

    This is a stub that will be wired to an actual LLM provider.
    """
    return {"prompt": prompt, "context": context, "generated": ""}
