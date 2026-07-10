/** Map known outline API error details to localized frontend messages. */
import type { TFunction } from "i18next";

const EXACT_MESSAGES: Record<string, string> = {
  "请先为作品选择包含阶段的故事结构": "outline:errors.needStructure",
  "请先生成阶段树并分配章节": "outline:errors.needStages",
  "Work not found": "outline:errors.workNotFound",
  "Stage not found": "outline:errors.stageNotFound",
  "Chapter not found": "outline:errors.chapterNotFound",
  "章节不属于该作品": "outline:errors.chapterWrongWork",
  "尚未配置 LLM 接口地址": "outline:errors.missingUrl",
  "无法解析 LLM 响应内容": "outline:errors.parseError",
  "无法从 LLM 响应中解析 JSON": "outline:errors.jsonParseFailed",
};

const AI_FAILED_PREFIX = "AI 生成失败：";
const CONNECTION_FAILED_PREFIX = "无法连接 LLM 服务：";
const HTTP_ERROR_PREFIX = "LLM 返回错误（";

/** Translate a backend detail string when recognized; otherwise use *fallbackKey*. */
export function translateOutlineApiError(
  message: string | null | undefined,
  t: TFunction,
  fallbackKey: string,
): string {
  if (!message) {
    return t(fallbackKey);
  }

  const exactKey = EXACT_MESSAGES[message];
  if (exactKey) {
    return t(exactKey);
  }

  if (message.startsWith(AI_FAILED_PREFIX)) {
    const nested = message.slice(AI_FAILED_PREFIX.length);
    const nestedExact = EXACT_MESSAGES[nested];
    if (nestedExact) {
      return t("outline:errors.aiFailed", { detail: t(nestedExact) });
    }
    if (nested.startsWith(CONNECTION_FAILED_PREFIX)) {
      return t("outline:errors.aiFailed", {
        detail: t("outline:errors.connectionFailed", {
          detail: nested.slice(CONNECTION_FAILED_PREFIX.length),
        }),
      });
    }
    if (nested.startsWith(HTTP_ERROR_PREFIX)) {
      const rest = nested.slice(HTTP_ERROR_PREFIX.length);
      const close = rest.indexOf("）：");
      if (close !== -1) {
        return t("outline:errors.aiFailed", {
          detail: t("outline:errors.httpError", {
            status: rest.slice(0, close),
            detail: rest.slice(close + 2),
          }),
        });
      }
    }
    return t("outline:errors.aiFailed", { detail: nested });
  }

  if (message.startsWith(CONNECTION_FAILED_PREFIX)) {
    return t("outline:errors.connectionFailed", {
      detail: message.slice(CONNECTION_FAILED_PREFIX.length),
    });
  }

  if (message.startsWith(HTTP_ERROR_PREFIX)) {
    const rest = message.slice(HTTP_ERROR_PREFIX.length);
    const close = rest.indexOf("）：");
    if (close !== -1) {
      return t("outline:errors.httpError", {
        status: rest.slice(0, close),
        detail: rest.slice(close + 2),
      });
    }
  }

  return message;
}
