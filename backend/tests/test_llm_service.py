"""Tests for the LLM service and connection-test endpoint (mocked transport)."""

import httpx
import pytest

from app.services.llm_service import (
    LLMConfigError,
    LLMConnection,
    LLMRequestError,
    chat_completion,
)


def _patch_transport(monkeypatch, handler) -> None:
    """Patch httpx.AsyncClient so all requests go through a mock transport."""
    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def make_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)


def test_connection_requires_url():
    """Building a connection without a URL raises a config error."""
    with pytest.raises(LLMConfigError):
        LLMConnection.from_settings({"url": "", "api_token": "x", "model": "m"})


async def test_chat_completion_success(monkeypatch):
    """A 200 response with choices yields the message content."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer secret"
        return httpx.Response(200, json={"choices": [{"message": {"content": "pong"}}]})

    _patch_transport(monkeypatch, handler)
    connection = LLMConnection(url="https://x/chat", api_token="secret", model="m")
    assert await chat_completion(connection, [{"role": "user", "content": "ping"}]) == "pong"


async def test_chat_completion_error_status(monkeypatch):
    """A non-200 response raises an LLMRequestError."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text="unauthorized")

    _patch_transport(monkeypatch, handler)
    connection = LLMConnection(url="https://x/chat", api_token="bad", model="m")
    with pytest.raises(LLMRequestError):
        await chat_completion(connection, [{"role": "user", "content": "ping"}])


async def test_llm_test_endpoint_ok(client, monkeypatch):
    """POST /api/llm/test reports success when the endpoint responds."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "pong"}}]})

    _patch_transport(monkeypatch, handler)
    response = await client.post(
        "/api/llm/test",
        json={"url": "https://x/chat", "api_token": "secret", "model": "m"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["sample"] == "pong"


async def test_llm_test_endpoint_missing_url(client):
    """POST /api/llm/test reports failure when no URL is configured."""
    response = await client.post("/api/llm/test", json={"url": "", "api_token": "", "model": ""})
    assert response.status_code == 200
    assert response.json()["ok"] is False
