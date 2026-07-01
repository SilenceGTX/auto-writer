"""Routes for reading and updating the global application settings.

Covers all five settings groups (``SYSTEM_SETTINGS_PAGE_DESIGN.md`` §3–7) plus
one-click configuration export / import (§8) for backup and migration.
"""

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    ConnectionSettings,
    DataSaveSettings,
    Preferences,
    SettingsImport,
    SettingsResponse,
    TypographySettings,
    WritingStyle,
)
from app.services.settings_service import (
    CONNECTION_KEY,
    DATA_SAVE_KEY,
    PREFERENCES_KEY,
    TYPOGRAPHY_KEY,
    WRITING_STYLE_KEY,
    get_all_settings,
    set_setting,
    set_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])


async def _read_all(db: AsyncSession) -> SettingsResponse:
    """Load every settings group merged with defaults as a response model."""
    data = await get_all_settings(db)
    return SettingsResponse(
        connection=data[CONNECTION_KEY],
        preferences=data[PREFERENCES_KEY],
        writing_style=data[WRITING_STYLE_KEY],
        data_save=data[DATA_SAVE_KEY],
        typography=data[TYPOGRAPHY_KEY],
    )


@router.get("", response_model=SettingsResponse)
async def read_settings(db: AsyncSession = Depends(get_db)) -> SettingsResponse:
    """Return all settings groups merged with their defaults."""
    return await _read_all(db)


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


@router.put("/data_save", response_model=DataSaveSettings)
async def update_data_save(
    payload: DataSaveSettings, db: AsyncSession = Depends(get_db)
) -> DataSaveSettings:
    """Persist the auto-save and snapshot persistence options."""
    await set_setting(db, DATA_SAVE_KEY, payload.model_dump())
    return payload


@router.put("/typography", response_model=TypographySettings)
async def update_typography(
    payload: TypographySettings, db: AsyncSession = Depends(get_db)
) -> TypographySettings:
    """Persist the reading font, line height, and eye-care theme."""
    await set_setting(db, TYPOGRAPHY_KEY, payload.model_dump())
    return payload


@router.get("/export", response_model=SettingsResponse)
async def export_settings(db: AsyncSession = Depends(get_db)) -> SettingsResponse:
    """Export all settings groups as a single configuration document."""
    return await _read_all(db)


@router.post("/import", response_model=SettingsResponse)
async def import_settings(
    payload: SettingsImport, db: AsyncSession = Depends(get_db)
) -> SettingsResponse:
    """Validate and apply a configuration document; only present groups change."""
    groups: dict[str, dict] = {}
    if payload.connection is not None:
        groups[CONNECTION_KEY] = payload.connection.model_dump()
    if payload.preferences is not None:
        groups[PREFERENCES_KEY] = payload.preferences.model_dump()
    if payload.writing_style is not None:
        groups[WRITING_STYLE_KEY] = payload.writing_style.model_dump()
    if payload.data_save is not None:
        groups[DATA_SAVE_KEY] = payload.data_save.model_dump()
    if payload.typography is not None:
        groups[TYPOGRAPHY_KEY] = payload.typography.model_dump()
    if groups:
        await set_settings(db, groups)
    logger.info("导入配置：{}", ", ".join(groups) or "（空）")
    return await _read_all(db)
