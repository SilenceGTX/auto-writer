/** Map known writing API error details to localized frontend messages. */
import type { TFunction } from "i18next";
import { translateLlmWrappedError } from "./llmApiError";

const EXACT_MESSAGES: Record<string, string> = {
  "当前章节没有前一章节": "writing:errors.noPreviousChapter",
  "前一章节尚无正文，无法生成前情提要": "writing:errors.previousEmpty",
  "chapter_id is required": "writing:errors.chapterIdRequired",
};

/** Translate a backend detail string when recognized; otherwise use *fallbackKey*. */
export function translateWritingApiError(
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
