/** Tests for ``@`` mention marker helpers. */
import { describe, expect, it } from "vitest";
import { buildMentionMarker, replaceRangeWithMention } from "../utils/mentionText";

describe("mentionText", () => {
  it("builds the canonical mention marker", () => {
    expect(buildMentionMarker("机械神器")).toBe("@机械神器 ");
  });

  it("replaces a selection range with a mention marker", () => {
    const value = "这是一个机械神器。";
    const next = replaceRangeWithMention(value, 4, 8, "机械神器");
    expect(next).toBe("这是一个@机械神器 。");
  });
});
