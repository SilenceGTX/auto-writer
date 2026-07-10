/** Map known outline API error details to localized frontend messages. */
import type { TFunction } from "i18next";
import { translateLlmWrappedError } from "./llmApiError";

const EXACT_MESSAGES: Record<string, string> = {
  "请先为作品选择包含阶段的故事结构": "outline:errors.needStructure",
  "请先生成阶段树并分配章节": "outline:errors.needStages",
  "章节不属于该作品": "outline:errors.chapterWrongWork",
};

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
  return translateLlmWrappedError(message, t, "errors:llm.aiFailed") ?? message;
}
