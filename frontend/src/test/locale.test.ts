/** Tests for locale detection helpers. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrowserLocale, isAppLocale } from "../utils/locale";

describe("locale utils", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognizes supported locales", () => {
    expect(isAppLocale("zh")).toBe(true);
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
  });

  it("maps browser languages to zh or en", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(detectBrowserLocale()).toBe("en");

    vi.stubGlobal("navigator", { language: "zh-CN" });
    expect(detectBrowserLocale()).toBe("zh");

    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(detectBrowserLocale()).toBe("zh");
  });
});
