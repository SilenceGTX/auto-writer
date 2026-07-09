"""LLM client service for OpenAI-compatible chat completion endpoints.

Reads the saved connection configuration, assembles request payloads from the
global preference parameters, and calls the configured chat-completions API.
Supports both buffered and streaming responses so outline/writing generation
(Phase 3+) can reuse the same client.
"""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx
from loguru import logger

_TEST_TIMEOUT_SECONDS = 30.0
_STREAM_TIMEOUT_SECONDS = 300.0


class LLMConfigError(Exception):
    """Raised when the LLM connection is not configured correctly."""

    def __init__(self, message: str, *, code: str = "config_error", detail: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.detail = detail


class LLMRequestError(Exception):
    """Raised when the LLM endpoint returns an error or is unreachable."""

    def __init__(self, message: str, *, code: str = "request_error", detail: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.detail = detail


@dataclass
class LLMConnection:
    """Resolved connection settings for an OpenAI-compatible endpoint."""

    url: str
    api_token: str
    model: str
    profile_id: str | None = None

    @classmethod
    def from_settings(cls, connection: dict) -> "LLMConnection":
        """Build a connection from the legacy single-connection settings dict."""
        url = (connection.get("url") or "").strip()
        if not url:
            raise LLMConfigError("尚未配置 LLM 接口地址", code="missing_url")
        return cls(
            url=url,
            api_token=(connection.get("api_token") or "").strip(),
            model=(connection.get("model") or "").strip(),
        )

    @classmethod
    def from_profile(cls, profile: dict) -> "LLMConnection":
        """Build a connection from one stored LLM profile."""
        url = (profile.get("url") or "").strip()
        if not url:
            raise LLMConfigError("尚未配置 LLM 接口地址", code="missing_url")
        return cls(
            url=url,
            api_token=(profile.get("api_token") or "").strip(),
            model=(profile.get("model") or "").strip(),
            profile_id=profile.get("id"),
        )


def _headers(connection: LLMConnection) -> dict[str, str]:
    """Build request headers, including bearer auth when a token is set."""
    headers = {"Content-Type": "application/json"}
    if connection.api_token:
        headers["Authorization"] = f"Bearer {connection.api_token}"
    return headers


def _payload(
    connection: LLMConnection,
    messages: list[dict[str, str]],
    params: dict | None,
    *,
    stream: bool,
) -> dict:
    """Assemble the chat-completion request body from messages and params."""
    body: dict = {"messages": messages, "stream": stream}
    if connection.model:
        body["model"] = connection.model
    for key in ("temperature", "top_p", "presence_penalty", "frequency_penalty", "max_tokens"):
        if params and params.get(key) is not None:
            body[key] = params[key]
    return body


async def chat_completion(
    connection: LLMConnection,
    messages: list[dict[str, str]],
    params: dict | None = None,
    *,
    task: str | None = None,
) -> str:
    """Call the chat-completions endpoint and return the message content."""
    body = _payload(connection, messages, params, stream=False)
    model = connection.model or "(default)"
    logger.debug(
        "LLM task={} profile_id={} model={}",
        task or "-",
        connection.profile_id or "-",
        model,
    )
    logger.info("调用 LLM url={} model={}", connection.url, model)
    try:
        async with httpx.AsyncClient(timeout=_TEST_TIMEOUT_SECONDS) as client:
            response = await client.post(connection.url, headers=_headers(connection), json=body)
    except httpx.HTTPError as exc:
        logger.error("连接 LLM 失败 url={} error={}", connection.url, exc)
        raise LLMRequestError(f"无法连接 LLM 服务：{exc}", code="connection_failed", detail=str(exc)) from exc

    if response.status_code != httpx.codes.OK:
        logger.warning("LLM 返回错误 status={} body={}", response.status_code, response.text[:200])
        raise LLMRequestError(
            f"LLM 返回错误（{response.status_code}）：{response.text[:200]}",
            code="http_error",
            detail=f"{response.status_code}: {response.text[:200]}",
        )

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        logger.error("无法解析 LLM 响应：{}", response.text[:200])
        raise LLMRequestError("无法解析 LLM 响应内容", code="parse_error") from exc

    logger.info("LLM 调用成功 model={} 字符数={}", model, len(content))
    return content


async def stream_chat_completion(
    connection: LLMConnection,
    messages: list[dict[str, str]],
    params: dict | None = None,
) -> AsyncIterator[str]:
    """Stream content deltas from the chat-completions endpoint (SSE)."""
    body = _payload(connection, messages, params, stream=True)
    try:
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT_SECONDS) as client:
            async with client.stream(
                "POST", connection.url, headers=_headers(connection), json=body
            ) as response:
                if response.status_code != httpx.codes.OK:
                    text = (await response.aread()).decode("utf-8", "replace")
                    raise LLMRequestError(
                        f"LLM 返回错误（{response.status_code}）：{text[:200]}",
                        code="http_error",
                        detail=f"{response.status_code}: {text[:200]}",
                    )
                async for line in response.aiter_lines():
                    delta = _parse_sse_delta(line)
                    if delta:
                        yield delta
    except httpx.HTTPError as exc:
        raise LLMRequestError(f"无法连接 LLM 服务：{exc}", code="connection_failed", detail=str(exc)) from exc


def _parse_sse_delta(line: str) -> str:
    """Extract the incremental content from one SSE ``data:`` line."""
    if not line.startswith("data:"):
        return ""
    payload = line[len("data:") :].strip()
    if not payload or payload == "[DONE]":
        return ""
    try:
        chunk = json.loads(payload)
        return chunk["choices"][0]["delta"].get("content") or ""
    except (KeyError, IndexError, ValueError):
        return ""


async def test_connection(connection: LLMConnection) -> str:
    """Issue a minimal completion to verify connectivity and authentication."""
    messages = [{"role": "user", "content": "ping"}]
    return await chat_completion(connection, messages, {"max_tokens": 16})
