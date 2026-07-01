/** Tests for the surrounding-paragraph extraction helper (强化衔接). */
import { describe, expect, it } from "vitest";
import { surroundingParagraphs } from "../utils/paragraphs";

describe("surroundingParagraphs", () => {
  const content = ["第一段。", "第二段。", "第三段。", "第四段。", "第五段。"].join("\n");

  it("returns up to two paragraphs before and after the selection", () => {
    const start = content.indexOf("第三段。");
    const end = start + "第三段。".length;
    const { preceding, following } = surroundingParagraphs(content, start, end);
    expect(preceding).toBe("第一段。\n\n第二段。");
    expect(following).toBe("第四段。\n\n第五段。");
  });

  it("clamps to the available paragraphs near the edges", () => {
    const start = content.indexOf("第一段。");
    const end = start + "第一段。".length;
    const { preceding, following } = surroundingParagraphs(content, start, end);
    expect(preceding).toBe("");
    expect(following).toBe("第二段。\n\n第三段。");
  });

  it("respects a custom paragraph count", () => {
    const start = content.indexOf("第四段。");
    const end = start + "第四段。".length;
    const { preceding, following } = surroundingParagraphs(content, start, end, 1);
    expect(preceding).toBe("第三段。");
    expect(following).toBe("第五段。");
  });
});
