/** Unit tests for outline API error localization. */
import "../i18n";
import i18n from "../i18n";
import { beforeEach, describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "../utils/apiError";
import { translateOutlineApiError } from "../utils/outlineApiError";

describe("extractApiErrorMessage", () => {
  it("pulls detail out of FastAPI JSON bodies", () => {
    expect(
      extractApiErrorMessage(
        JSON.stringify({ detail: "请先生成阶段树并分配章节" }),
        400,
      ),
    ).toBe("请先生成阶段树并分配章节");
  });
});

describe("translateOutlineApiError", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates known outline validation errors", () => {
    const t = i18n.t.bind(i18n);
    expect(
      translateOutlineApiError("请先生成阶段树并分配章节", t, "outline:toast.generateChaptersFailed"),
    ).toBe("Generate the stage tree and assign chapters first");
  });

  it("translates nested LLM config failures under AI generation errors", () => {
    const t = i18n.t.bind(i18n);
    expect(
      translateOutlineApiError(
        "AI 生成失败：尚未配置 LLM 接口地址",
        t,
        "outline:toast.generateChaptersFailed",
      ),
    ).toBe("AI request failed: LLM endpoint URL is not configured");
  });

  it("translates connection failures nested under AI generation errors", () => {
    const t = i18n.t.bind(i18n);
    expect(
      translateOutlineApiError(
        "AI 生成失败：无法连接 LLM 服务：timeout",
        t,
        "outline:toast.generateChaptersFailed",
      ),
    ).toBe("AI request failed: Could not reach LLM service: timeout");
  });

  it("translates timeout failures nested under AI generation errors", () => {
    const t = i18n.t.bind(i18n);
    expect(
      translateOutlineApiError(
        "AI 生成失败：LLM 请求超时（300.0s）：ReadTimeout | simulated",
        t,
        "outline:toast.generateChaptersFailed",
      ),
    ).toBe(
      "AI request failed: LLM request timed out (300.0s): ReadTimeout | simulated",
    );
  });
});
