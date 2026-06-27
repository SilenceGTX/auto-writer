"""Routes for reading and updating the global application settings."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    ConnectionSettings,
    Preferences,
    SettingsResponse,
    WritingStyle,
)
from app.services.settings_service import (
    CONNECTION_KEY,
    PREFERENCES_KEY,
    WRITING_STYLE_KEY,
    get_all_settings,
    set_setting,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def read_settings(db: AsyncSession = Depends(get_db)) -> SettingsResponse:
    """Return all settings groups merged with their defaults."""
    data = await get_all_settings(db)
    return SettingsResponse(
        connection=data[CONNECTION_KEY],
        preferences=data[PREFERENCES_KEY],
        writing_style=data[WRITING_STYLE_KEY],
    )


@router.put("/connection", response_model=ConnectionSettings)
async def update_connection(
    payload: ConnectionSettings, db: AsyncSession = Depends(get_db)
) -> ConnectionSettings:
    """Persist the LLM connection configuration."""
    await set_setting(db, CONNECTION_KEY, payload.model_dump())
    return payload


@router.put("/preferences", response_model=Preferences)
async def update_preferences(
    payload: Preferences, db: AsyncSession = Depends(get_db)
) -> Preferences:
    """Persist the global generation preferences."""
    await set_setting(db, PREFERENCES_KEY, payload.model_dump())
    return payload


@router.put("/writing_style", response_model=WritingStyle)
async def update_writing_style(
    payload: WritingStyle, db: AsyncSession = Depends(get_db)
) -> WritingStyle:
    """Persist the global writing-style text."""
    await set_setting(db, WRITING_STYLE_KEY, payload.model_dump())
    return payload
