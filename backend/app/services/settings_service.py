"""Key-value access helpers for the application settings store.

Wraps the ``app_settings`` table (``designs/DATA_STORAGE_DESIGN.md`` §4.11),
storing each settings group as a JSON document under a well-known key and
falling back to sane defaults when a key has not been saved yet.
"""

import json
from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppSetting

CONNECTION_KEY = "connection"
PREFERENCES_KEY = "preferences"
WRITING_STYLE_KEY = "writing_style"
DATA_SAVE_KEY = "data_save"
TYPOGRAPHY_KEY = "typography"

_DEFAULT_STAGE_PREFERENCE = {
    "temperature": 0.7,
    "top_p": 0.9,
    "presence_penalty": 0.0,
    "frequency_penalty": 0.0,
    "max_tokens": 2048,
}

DEFAULT_SETTINGS: dict[str, dict] = {
    CONNECTION_KEY: {"url": "", "api_token": "", "model": ""},
    PREFERENCES_KEY: {
        "outline": deepcopy(_DEFAULT_STAGE_PREFERENCE),
        "writing": deepcopy(_DEFAULT_STAGE_PREFERENCE),
    },
    WRITING_STYLE_KEY: {"text": ""},
    DATA_SAVE_KEY: {
        "input_debounce_seconds": 2,
        "autosave_interval_seconds": 30,
        "snapshot_path": "snapshots",
        "history_versions": 3,
    },
    TYPOGRAPHY_KEY: {"font_family": "", "line_height": 1.8, "reading_theme": "sepia"},
}


async def get_setting(session: AsyncSession, key: str) -> dict:
    """Return the stored JSON value for a settings key, or its default."""
    row = await session.get(AppSetting, key)
    if row is None:
        return deepcopy(DEFAULT_SETTINGS.get(key, {}))
    return json.loads(row.value)


async def get_all_settings(session: AsyncSession) -> dict[str, dict]:
    """Return every known settings group, merged over the defaults."""
    result = await session.execute(select(AppSetting))
    stored = {row.key: json.loads(row.value) for row in result.scalars().all()}
    return {key: stored.get(key, deepcopy(default)) for key, default in DEFAULT_SETTINGS.items()}


async def set_setting(session: AsyncSession, key: str, value: dict) -> dict:
    """Upsert a settings key with the given JSON-serializable value."""
    serialized = json.dumps(value, ensure_ascii=False)
    row = await session.get(AppSetting, key)
    if row is None:
        session.add(AppSetting(key=key, value=serialized))
    else:
        row.value = serialized
    await session.commit()
    return value


async def set_settings(session: AsyncSession, groups: dict[str, dict]) -> None:
    """Upsert several settings groups in a single transaction (config import)."""
    for key, value in groups.items():
        serialized = json.dumps(value, ensure_ascii=False)
        row = await session.get(AppSetting, key)
        if row is None:
            session.add(AppSetting(key=key, value=serialized))
        else:
            row.value = serialized
    await session.commit()
