"""Tests for the application settings endpoints."""


async def test_get_settings_returns_defaults(client):
    """GET /api/settings returns default groups before anything is saved."""
    response = await client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert len(data["llm_profiles"]) == 1
    assert data["llm_profiles"][0]["url"] == ""
    assert data["llm_assignments"]["writing_chat"] == data["llm_profiles"][0]["id"]
    assert data["preferences"]["outline"]["temperature"] == 0.7
    assert data["preferences"]["review"]["temperature"] == 0.3
    assert data["writing_style"]["text"] == ""
    assert data["data_save"]["autosave_interval_seconds"] == 30
    assert data["typography"]["reading_theme"] == "sepia"
    assert data["locale"]["locale"] == "zh"


async def test_update_locale(client):
    """Locale preference is validated and persisted."""
    assert (await client.put("/api/settings/locale", json={"locale": "en"})).status_code == 200
    data = (await client.get("/api/settings")).json()
    assert data["locale"]["locale"] == "en"


async def test_locale_validation_rejects_unknown(client):
    """Unsupported locale codes are rejected."""
    assert (await client.put("/api/settings/locale", json={"locale": "fr"})).status_code == 422


async def test_update_data_save_and_typography(client):
    """Data-save and typography groups are validated and persisted."""
    data_save = {
        "input_debounce_seconds": 3,
        "autosave_interval_seconds": 60,
        "snapshot_path": "data/snapshots",
        "history_versions": 5,
    }
    typography = {"font_family": "Noto Serif", "line_height": 2.0, "reading_theme": "dark"}
    assert (await client.put("/api/settings/data_save", json=data_save)).status_code == 200
    assert (await client.put("/api/settings/typography", json=typography)).status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["data_save"]["history_versions"] == 5
    assert data["typography"]["font_family"] == "Noto Serif"


async def test_data_save_validation_rejects_out_of_range(client):
    """Out-of-range history version counts are rejected."""
    bad = {
        "input_debounce_seconds": 2,
        "autosave_interval_seconds": 30,
        "snapshot_path": "data/snapshots",
        "history_versions": 99,
    }
    assert (await client.put("/api/settings/data_save", json=bad)).status_code == 422


async def test_export_and_import_roundtrip(client):
    """Exported configuration can be re-imported, applying only present groups."""
    await client.put("/api/settings/writing_style", json={"text": "古典雅致"})
    exported = (await client.get("/api/settings/export")).json()

    response = await client.post(
        "/api/settings/import",
        json={"writing_style": {"text": "现代简洁"}, "typography": exported["typography"]},
    )
    assert response.status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["writing_style"]["text"] == "现代简洁"


async def test_import_rejects_invalid_config(client):
    """Importing a structurally invalid group is rejected with a 422."""
    response = await client.post(
        "/api/settings/import",
        json={"typography": {"reading_theme": "neon"}},
    )
    assert response.status_code == 422


async def test_update_connection_migrates_to_llm_profiles(client):
    """Legacy connection updates map onto the first LLM profile."""
    payload = {
        "url": "https://api.example.com/v1/chat/completions",
        "api_token": "secret",
        "model": "gpt-test",
    }
    put = await client.put("/api/settings/connection", json=payload)
    assert put.status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["llm_profiles"][0]["url"] == payload["url"]
    assert data["llm_profiles"][0]["model"] == payload["model"]
    assert data["llm_assignments"]["review_chat"] == data["llm_profiles"][0]["id"]


async def test_update_llm_profiles_and_assignments(client):
    """LLM profiles and assignments are validated and persisted."""
    first = {
        "id": "profile-a",
        "url": "https://api.example.com/v1/chat/completions",
        "api_token": "secret",
        "model": "gpt-a",
    }
    second = {
        "id": "profile-b",
        "url": "https://api.example.com/v1/chat/completions",
        "api_token": "secret",
        "model": "gpt-b",
    }
    assignments = {
        "outline_stages": "profile-a",
        "outline_chapters": "profile-a",
        "writing_draft": "profile-a",
        "writing_chat": "profile-b",
        "writing_rewrite": "profile-b",
        "review_chat": "profile-b",
    }
    response = await client.put(
        "/api/settings/llm",
        json={"profiles": [first, second], "assignments": assignments},
    )
    assert response.status_code == 200

    data = (await client.get("/api/settings")).json()
    assert len(data["llm_profiles"]) == 2
    assert data["llm_assignments"]["writing_chat"] == "profile-b"


async def test_import_legacy_connection_payload(client):
    """Importing an old single-connection config creates one profile."""
    payload = {
        "connection": {
            "url": "https://legacy.example.com/v1/chat/completions",
            "api_token": "legacy",
            "model": "legacy-model",
        }
    }
    response = await client.post("/api/settings/import", json=payload)
    assert response.status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["llm_profiles"][0]["url"] == payload["connection"]["url"]
    assert data["llm_profiles"][0]["model"] == payload["connection"]["model"]
    assert data["llm_assignments"]["outline_stages"] == data["llm_profiles"][0]["id"]


async def test_update_preferences_and_writing_style(client):
    """Preferences and writing style are validated and persisted."""
    prefs = {
        "outline": {
            "temperature": 1.0,
            "top_p": 0.95,
            "presence_penalty": 0.6,
            "frequency_penalty": 0.6,
            "max_tokens": 4096,
        },
        "writing": {
            "temperature": 0.3,
            "top_p": 0.8,
            "presence_penalty": 0.0,
            "frequency_penalty": 0.0,
            "max_tokens": 512,
        },
        "review": {
            "temperature": 0.2,
            "top_p": 0.8,
            "presence_penalty": 0.5,
            "frequency_penalty": 0.5,
            "max_tokens": 1024,
        },
    }
    assert (await client.put("/api/settings/preferences", json=prefs)).status_code == 200
    assert (
        await client.put("/api/settings/writing_style", json={"text": "古典雅致"})
    ).status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["preferences"]["outline"]["max_tokens"] == 4096
    assert data["preferences"]["review"]["max_tokens"] == 1024
    assert data["writing_style"]["text"] == "古典雅致"


async def test_preferences_validation_rejects_out_of_range(client):
    """Out-of-range sampling parameters are rejected."""
    bad = {
        "outline": {"temperature": 5},
        "writing": {},
        "review": {},
    }
    response = await client.put("/api/settings/preferences", json=bad)
    assert response.status_code == 422


async def test_llm_profiles_reject_more_than_five(client):
    """Saving more than five LLM profiles is rejected."""
    profiles = [
        {
            "id": f"profile-{index}",
            "url": "https://api.example.com/v1/chat/completions",
            "api_token": "",
            "model": f"m-{index}",
        }
        for index in range(6)
    ]
    assignments = {task: "profile-0" for task in [
        "outline_stages",
        "outline_chapters",
        "writing_draft",
        "writing_chat",
        "writing_rewrite",
        "review_chat",
    ]}
    response = await client.put(
        "/api/settings/llm",
        json={"profiles": profiles, "assignments": assignments},
    )
    assert response.status_code == 422
