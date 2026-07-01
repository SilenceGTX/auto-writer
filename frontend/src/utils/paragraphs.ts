/** Helpers for extracting surrounding paragraphs around a text selection.
 *
 * Used by the writing page's local rewrite ("强化衔接") to feed the LLM the few
 * natural paragraphs before and after a selected passage so the rewrite stays
 * cohesive with its context.
 */

/** Split text into non-empty, trimmed natural paragraphs (newline-delimited). */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * Return up to ``count`` paragraphs immediately before ``start`` and after
 * ``end`` within ``content``. Offsets are the selection's character range in the
 * full chapter body.
 */
export function surroundingParagraphs(
  content: string,
  start: number,
  end: number,
  count = 2,
): { preceding: string; following: string } {
  const before = splitParagraphs(content.slice(0, start));
  const after = splitParagraphs(content.slice(end));
  return {
    preceding: before.slice(-count).join("\n\n"),
    following: after.slice(0, count).join("\n\n"),
  };
}
