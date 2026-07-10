"""Routes for reading and updating the global application settings.

Covers all settings groups (``SYSTEM_SETTINGS_PAGE_DESIGN.md`` §3–7) plus
one-click configuration export / import (§8) for backup and migration.
"""

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    ConnectionSettings,
    DataSaveSettings,
    LLMAssignments,
    LLMProfile,
    LLMSettingsUpdate,
    LocaleSettings,
    Preferences,
    SettingsImport,
    SettingsResponse,
    TypographySettings,
    WritingStyle,
)
from app.services.llm_settings import (
    LLM_ASSIGNMENTS_KEY,
    LLM_PROFILES_KEY,
    default_assignments,
    profile_from_legacy_connection,
    sanitize_assignments,
    validate_llm_payload,
)
from app.services.settings_service import (
    CONNECTION_KEY,
    DATA_SAVE_KEY,
    LOCALE_KEY,
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
        llm_profiles=data[LLM_PROFILES_KEY],
        llm_assignments=data[LLM_ASSIGNMENTS_KEY],
        preferences=data[PREFERENCES_KEY],
        writing_style=data[WRITING_STYLE_KEY],
        data_save=data[DATA_SAVE_KEY],
        typography=data[TYPOGRAPHY_KEY],
        locale=data[LOCALE_KEY],
    )


@router.get("", response_model=SettingsResponse)
async def read_settings(db: AsyncSession = Depends(get_db)) -> SettingsResponse:
    """Return all settings groups merged with their defaults."""
    return await _read_all(db)


@router.put("/llm", response_model=LLMSettingsUpdate)
async def update_llm_settings(
    payload: LLMSettingsUpdate, db: AsyncSession = Depends(get_db)
) -> LLMSettingsUpdate:
    """Persist LLM profiles and per-task assignments."""
    profiles = [profile.model_dump() for profile in payload.profiles]
    assignments = sanitize_assignments(
        payload.assignments.model_dump(), profiles
    )
    try:
        validate_llm_payload(profiles, assignments)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await set_settings(
        db,
        {
            LLM_PROFILES_KEY: profiles,
            LLM_ASSIGNMENTS_KEY: assignments,
        },
    )
    return LLMSettingsUpdate(
        profiles=[LLMProfile.model_validate(profile) for profile in profiles],
        assignments=LLMAssignments.model_validate(assignments),
    )


@router.put("/connection", response_model=ConnectionSettings)
async def update_connection(
    payload: ConnectionSettings, db: AsyncSession = Depends(get_db)
) -> ConnectionSettings:
    """Legacy endpoint: update the first LLM profile from a single connection."""
    data = await get_all_settings(db)
    profiles = data[LLM_PROFILES_KEY]
    if profiles:
        profiles[0].update(payload.model_dump())
    else:
        profile = profile_from_legacy_connection(payload.model_dump())
        profiles = [profile]
    assignments = sanitize_assignments(data[LLM_ASSIGNMENTS_KEY], profiles)
    await set_settings(
        db,
        {
            LLM_PROFILES_KEY: profiles,
            LLM_ASSIGNMENTS_KEY: assignments,
            CONNECTION_KEY: payload.model_dump(),
        },
    )
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


@router.put("/locale", response_model=LocaleSettings)
async def update_locale(
    payload: LocaleSettings, db: AsyncSession = Depends(get_db)
) -> LocaleSettings:
    """Persist the UI and AI prompt language preference."""
    await set_setting(db, LOCALE_KEY, payload.model_dump())
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

    if payload.llm_profiles is not None:
        profiles = [profile.model_dump() for profile in payload.llm_profiles]
        assignments_source = (
            payload.llm_assignments.model_dump()
            if payload.llm_assignments is not None
            else default_assignments(profiles[0]["id"])
        )
        assignments = sanitize_assignments(assignments_source, profiles)
        try:
            validate_llm_payload(profiles, assignments)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        groups[LLM_PROFILES_KEY] = profiles
        groups[LLM_ASSIGNMENTS_KEY] = assignments
    elif payload.connection is not None:
        profile = profile_from_legacy_connection(payload.connection.model_dump())
        profiles = [profile]
        assignments = (
            payload.llm_assignments.model_dump()
            if payload.llm_assignments is not None
            else default_assignments(profile["id"])
        )
        assignments = sanitize_assignments(assignments, profiles)
        groups[LLM_PROFILES_KEY] = profiles
        groups[LLM_ASSIGNMENTS_KEY] = assignments

    if payload.preferences is not None:
        groups[PREFERENCES_KEY] = payload.preferences.model_dump()
    if payload.writing_style is not None:
        groups[WRITING_STYLE_KEY] = payload.writing_style.model_dump()
    if payload.data_save is not None:
        groups[DATA_SAVE_KEY] = payload.data_save.model_dump()
    if payload.typography is not None:
        groups[TYPOGRAPHY_KEY] = payload.typography.model_dump()
    if payload.locale is not None:
        groups[LOCALE_KEY] = payload.locale.model_dump()

    if groups:
        await set_settings(db, groups)
    logger.info("导入配置：{}", ", ".join(groups) or "（空）")
    return await _read_all(db)
