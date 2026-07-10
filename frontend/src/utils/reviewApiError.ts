/** Map known review API error details to localized frontend messages. */
import type { TFunction } from "i18next";
import { translateLlmWrappedError } from "./llmApiError";

/** Translate a backend detail string when recognized; otherwise use *fallbackKey*. */
export function translateReviewApiError(
  message: string | null | undefined,
  t: TFunction,
  fallbackKey: string,
): string {
  if (!message) {
    return t(fallbackKey);
  }
  return translateLlmWrappedError(message, t, "errors:llm.aiFailed") ?? message;
}
