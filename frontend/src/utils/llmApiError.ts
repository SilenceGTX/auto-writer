/** Shared localization for LLM-related backend error detail strings. */
import type { TFunction } from "i18next";

const LLM_EXACT_MESSAGES: Record<string, string> = {
  "尚未配置 LLM 接口地址": "errors:llm.missingUrl",
  "无法解析 LLM 响应内容": "errors:llm.parseError",
  "无法从 LLM 响应中解析 JSON": "errors:llm.jsonParseFailed",
  "Work not found": "errors:notFound.work",
  "Chapter not found": "errors:notFound.chapter",
  "Stage not found": "errors:notFound.stage",
};

const AI_PREFIXES = ["AI 生成失败：", "AI 调用失败："] as const;
const CONNECTION_FAILED_PREFIX = "无法连接 LLM 服务：";
const HTTP_ERROR_PREFIX = "LLM 返回错误（";

/** Translate a nested LLM detail (config / connection / HTTP / parse). */
export function translateLlmDetail(detail: string, t: TFunction): string {
  const exactKey = LLM_EXACT_MESSAGES[detail];
  if (exactKey) {
    return t(exactKey);
  }
  if (detail.startsWith(CONNECTION_FAILED_PREFIX)) {
    return t("errors:llm.connectionFailed", {
      detail: detail.slice(CONNECTION_FAILED_PREFIX.length),
    });
  }
  if (detail.startsWith(HTTP_ERROR_PREFIX)) {
    const rest = detail.slice(HTTP_ERROR_PREFIX.length);
    const close = rest.indexOf("）：");
    if (close !== -1) {
      return t("errors:llm.httpError", {
        status: rest.slice(0, close),
        detail: rest.slice(close + 2),
      });
    }
  }
  return detail;
}

/** Translate a backend error that may wrap an LLM failure under an AI prefix. */
export function translateLlmWrappedError(
  message: string,
  t: TFunction,
  aiFailedKey: string,
): string | null {
  for (const prefix of AI_PREFIXES) {
    if (message.startsWith(prefix)) {
      return t(aiFailedKey, { detail: translateLlmDetail(message.slice(prefix.length), t) });
    }
  }
  const exactKey = LLM_EXACT_MESSAGES[message];
  if (exactKey) {
    return t(exactKey);
  }
  if (message.startsWith(CONNECTION_FAILED_PREFIX) || message.startsWith(HTTP_ERROR_PREFIX)) {
    return translateLlmDetail(message, t);
  }
  return null;
}
