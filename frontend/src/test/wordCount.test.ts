/** Tests for the client-side word counter (mirrors the backend count_words). */
import { describe, expect, it } from "vitest";
import { countWords } from "../utils/wordCount";

describe("countWords", () => {
  it("counts each CJK character as one word", () => {
    expect(countWords("今天天气很好")).toBe(6);
  });

  it("ignores whitespace and punctuation", () => {
    expect(countWords("你好，世界！\n再见")).toBe(6);
  });

  it("counts Latin/number runs as single words", () => {
    expect(countWords("使用 GPT4 写作 demo")).toBe(6);
  });

  it("returns zero for empty input", () => {
    expect(countWords("")).toBe(0);
  });
});
