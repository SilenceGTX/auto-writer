"""Tests for desktop single-process mode (static SPA + launcher helpers)."""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.launcher import find_free_port


def test_find_free_port_returns_available_port():
    """find_free_port binds to an unused localhost port."""
    port = find_free_port()
    assert 17890 <= port < 17940


@pytest_asyncio.fixture
async def desktop_client(tmp_path, monkeypatch):
    """Yield an HTTP client for an app serving a temporary static bundle."""
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<html><body>desktop</body></html>", encoding="utf-8")

    monkeypatch.setenv("AW_STATIC_DIR", str(static))
    monkeypatch.setenv("AW_DESKTOP_MODE", "1")
    get_settings.cache_clear()

    from app.main import create_app

    application = create_app()
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client

    get_settings.cache_clear()


async def test_desktop_serves_spa_index(desktop_client):
    """The bundled frontend index is served at / when static_dir is configured."""
    response = await desktop_client.get("/")
    assert response.status_code == 200
    assert "desktop" in response.text


async def test_desktop_api_still_available(desktop_client):
    """API routes remain reachable when the SPA is mounted."""
    response = await desktop_client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
