/** Tests for reading the active text selection in inputs and rendered content. */
import { describe, expect, it } from "vitest";
import { getActiveSelectionText } from "../utils/selection";

describe("getActiveSelectionText", () => {
  it("returns textarea selection text", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "hello world";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 5;
    document.body.appendChild(textarea);
    textarea.focus();

    expect(getActiveSelectionText()).toBe("hello");

    textarea.remove();
  });

  it("returns rendered page selection text", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "审阅正文选区";
    document.body.appendChild(paragraph);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getActiveSelectionText()).toBe("审阅正文选区");

    selection?.removeAllRanges();
    paragraph.remove();
  });
});
