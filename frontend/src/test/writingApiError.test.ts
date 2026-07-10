/** Unit tests for writing API error localization. */
import "../i18n";
import i18n from "../i18n";
import { beforeEach, describe, expect, it } from "vitest";
import { translateWritingApiError } from "../utils/writingApiError";

describe("translateWritingApiError", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates writing-specific validation errors", () => {
    const t = i18n.t.bind(i18n);
    expect(
      translateWritingApiError(
        "前一章节尚无正文，无法生成前情提要",
        t,
        "writing:toast.generateRecapFailed",
      ),
    ).toBe("The previous chapter has no body text to summarize");
  });

  it("translates AI call failures with nested LLM config errors", () => {
    const t = i18n.t.bind(i18n);
    expect(
      translateWritingApiError(
        "AI 调用失败：尚未配置 LLM 接口地址",
        t,
        "writing:toast.generateDraftFailed",
      ),
    ).toBe("AI request failed: LLM endpoint URL is not configured");
  });
});
