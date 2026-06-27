"""Tests for the application settings endpoints."""


async def test_get_settings_returns_defaults(client):
    """GET /api/settings returns default groups before anything is saved."""
    response = await client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["connection"] == {"url": "", "api_token": "", "model": ""}
    assert data["preferences"]["outline"]["temperature"] == 0.7
    assert data["writing_style"]["text"] == ""


async def test_update_connection_persists(client):
    """Saving the connection config is reflected on subsequent reads."""
    payload = {
        "url": "https://api.example.com/v1/chat/completions",
        "api_token": "secret",
        "model": "gpt-test",
    }
    put = await client.put("/api/settings/connection", json=payload)
    assert put.status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["connection"] == payload


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
    }
    assert (await client.put("/api/settings/preferences", json=prefs)).status_code == 200
    assert (
        await client.put("/api/settings/writing_style", json={"text": "古典雅致"})
    ).status_code == 200

    data = (await client.get("/api/settings")).json()
    assert data["preferences"]["outline"]["max_tokens"] == 4096
    assert data["writing_style"]["text"] == "古典雅致"


async def test_preferences_validation_rejects_out_of_range(client):
    """Out-of-range sampling parameters are rejected."""
    bad = {"outline": {"temperature": 5}, "writing": {}}
    response = await client.put("/api/settings/preferences", json=bad)
    assert response.status_code == 422
