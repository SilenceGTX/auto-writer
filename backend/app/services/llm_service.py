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

# Short budget for connection tests (small max_tokens). Generation often needs
# much longer—chapter outlines especially—so those use the long request timeout.
_CONNECT_TIMEOUT_SECONDS = 30.0
_TEST_TIMEOUT_SECONDS = 30.0
_REQUEST_TIMEOUT_SECONDS = 300.0
# Per-call budget for outline stage/chapter generation (not the whole multi-stage HTTP request).
OUTLINE_TIMEOUT_SECONDS = 120.0
_STREAM_TIMEOUT_SECONDS = 300.0


class ChatCompletionResult(str):
    """Chat completion text with optional finish_reason and token usage."""

    finish_reason: str | None
    usage: dict | None

    def __new__(
        cls,
        content: str,
        *,
        finish_reason: str | None = None,
        usage: dict | None = None,
    ) -> "ChatCompletionResult":
        return str.__new__(cls, content)

    def __init__(
        self,
        content: str,
        *,
        finish_reason: str | None = None,
        usage: dict | None = None,
    ) -> None:
        self.finish_reason = finish_reason
        self.usage = usage


class LLMConfigError(Exception):
    """Raised when the LLM connection is not configured correctly."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "config_error",
        detail: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.detail = detail


class LLMRequestError(Exception):
    """Raised when the LLM endpoint returns an error or is unreachable."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "request_error",
        detail: str | None = None,
    ) -> None:
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


def _http_timeout(total_seconds: float) -> httpx.Timeout:
    """Build an httpx timeout with a bounded connect phase."""
    return httpx.Timeout(total_seconds, connect=_CONNECT_TIMEOUT_SECONDS)


def _format_http_error(exc: BaseException) -> str:
    """Return a detailed, non-empty description of an httpx/network failure."""
    parts = [type(exc).__name__]
    message = str(exc).strip()
    if message:
        parts.append(message)
    else:
        parts.append(repr(exc))
    request = getattr(exc, "request", None)
    if request is not None:
        parts.append(f"method={request.method} url={request.url}")
    cause = exc.__cause__ or exc.__context__
    if cause is not None and cause is not exc:
        cause_msg = str(cause).strip() or repr(cause)
        parts.append(f"cause={type(cause).__name__}: {cause_msg}")
    return " | ".join(parts)


def _error_code_for_http_error(exc: httpx.HTTPError) -> str:
    """Map an httpx failure to a stable error code for frontend mapping."""
    if isinstance(exc, httpx.TimeoutException):
        return "timeout"
    return "connection_failed"


def _log_http_failure(
    *,
    url: str,
    task: str | None,
    model: str,
    timeout: httpx.Timeout,
    body: dict,
    messages: list[dict[str, str]],
    has_token: bool,
    exc: httpx.HTTPError,
) -> None:
    """Log connection/timeout failures with enough context to diagnose flaky hosts."""
    message_chars = sum(len(message.get("content") or "") for message in messages)
    logger.error(
        "连接 LLM 失败 type={} detail={} url={} task={} model={} "
        "timeout(connect={}, read={}, write={}, pool={}) "
        "messages={} message_chars={} max_tokens={} has_token={}",
        type(exc).__name__,
        _format_http_error(exc),
        url,
        task or "-",
        model,
        timeout.connect,
        timeout.read,
        timeout.write,
        timeout.pool,
        len(messages),
        message_chars,
        body.get("max_tokens"),
        has_token,
    )
    logger.debug("连接 LLM 失败堆栈", exc_info=exc)


async def chat_completion(
    connection: LLMConnection,
    messages: list[dict[str, str]],
    params: dict | None = None,
    *,
    task: str | None = None,
    timeout_seconds: float | None = None,
) -> ChatCompletionResult:
    """Call the chat-completions endpoint and return content with metadata."""
    body = _payload(connection, messages, params, stream=False)
    model = connection.model or "(default)"
    timeout = _http_timeout(timeout_seconds or _REQUEST_TIMEOUT_SECONDS)
    message_chars = sum(len(message.get("content") or "") for message in messages)
    logger.debug(
        "LLM task={} profile_id={} model={} timeout={}s messages={} message_chars={} max_tokens={}",
        task or "-",
        connection.profile_id or "-",
        model,
        timeout.read,
        len(messages),
        message_chars,
        body.get("max_tokens"),
    )
    logger.info("调用 LLM url={} model={} task={}", connection.url, model, task or "-")
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(connection.url, headers=_headers(connection), json=body)
    except httpx.HTTPError as exc:
        _log_http_failure(
            url=connection.url,
            task=task,
            model=model,
            timeout=timeout,
            body=body,
            messages=messages,
            has_token=bool(connection.api_token),
            exc=exc,
        )
        detail = _format_http_error(exc)
        code = _error_code_for_http_error(exc)
        if code == "timeout":
            message = f"LLM 请求超时（{timeout.read}s）：{detail}"
        else:
            message = f"无法连接 LLM 服务：{detail}"
        raise LLMRequestError(message, code=code, detail=detail) from exc

    if response.status_code != httpx.codes.OK:
        logger.warning(
            "LLM 返回错误 status={} task={} body={}",
            response.status_code,
            task or "-",
            response.text[:500],
        )
        raise LLMRequestError(
            f"LLM 返回错误（{response.status_code}）：{response.text[:200]}",
            code="http_error",
            detail=f"{response.status_code}: {response.text[:200]}",
        )

    try:
        data = response.json()
        choice = data["choices"][0]
        content = choice["message"]["content"]
        finish_reason = choice.get("finish_reason")
        usage = data.get("usage") if isinstance(data.get("usage"), dict) else None
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        logger.error(
            "无法解析 LLM 响应 task={} body={}",
            task or "-",
            response.text[:500],
        )
        raise LLMRequestError("无法解析 LLM 响应内容", code="parse_error") from exc

    result = ChatCompletionResult(content, finish_reason=finish_reason, usage=usage)
    if finish_reason == "length":
        logger.warning(
            "LLM 输出可能被截断 model={} task={} finish_reason={} usage={} 字符数={}",
            model,
            task or "-",
            finish_reason,
            usage,
            len(result),
        )
    else:
        logger.info(
            "LLM 调用成功 model={} task={} finish_reason={} usage={} 字符数={}",
            model,
            task or "-",
            finish_reason,
            usage,
            len(result),
        )
    return result


async def stream_chat_completion(
    connection: LLMConnection,
    messages: list[dict[str, str]],
    params: dict | None = None,
) -> AsyncIterator[str]:
    """Stream content deltas from the chat-completions endpoint (SSE)."""
    body = _payload(connection, messages, params, stream=True)
    timeout = _http_timeout(_STREAM_TIMEOUT_SECONDS)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
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
        detail = _format_http_error(exc)
        code = _error_code_for_http_error(exc)
        logger.error("流式连接 LLM 失败 detail={}", detail)
        if code == "timeout":
            message = f"LLM 请求超时（{timeout.read}s）：{detail}"
        else:
            message = f"无法连接 LLM 服务：{detail}"
        raise LLMRequestError(message, code=code, detail=detail) from exc


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
    result = await chat_completion(
        connection,
        messages,
        {"max_tokens": 16},
        task="connection_test",
        timeout_seconds=_TEST_TIMEOUT_SECONDS,
    )
    return str(result)
