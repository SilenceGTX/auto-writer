/** Tests for the reading typography application helper. */
import { describe, expect, it } from "vitest";
import type { TypographySettings } from "../api";
import { applyTypography } from "../utils/typography";

describe("applyTypography", () => {
  it("writes the font, line height, and reading theme onto the document root", () => {
    const settings: TypographySettings = {
      font_family: "Noto Serif SC",
      line_height: 2.2,
      reading_theme: "dark",
    };

    applyTypography(settings);

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--reading-font-family")).toBe("Noto Serif SC");
    expect(root.style.getPropertyValue("--reading-line-height")).toBe("2.2");
    expect(root.getAttribute("data-reading-theme")).toBe("dark");
  });

  it("falls back to inherit when no font family is provided", () => {
    applyTypography({ font_family: "", line_height: 1.8, reading_theme: "sepia" });

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--reading-font-family")).toBe("inherit");
    expect(root.getAttribute("data-reading-theme")).toBe("sepia");
  });
});
