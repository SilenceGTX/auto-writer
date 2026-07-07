/** Helpers for reading the user's current text selection across inputs and DOM.
 *
 * Supports the global "加入灵感" action (``GENERAL_UI_DESIGN.md`` G3): a snippet
 * may be selected inside a textarea/input (where ``window.getSelection`` returns
 * nothing) or in rendered page content. This unifies both cases.
 */

/** A non-empty selection inside the active input, with absolute offsets. */
export interface TextSelectionRange {
  text: string;
  start: number;
  end: number;
}

/** Return the currently selected text from the active input or page selection. */
export function getActiveSelectionText(): string {
  return getActiveSelectionRange()?.text ?? "";
}

/** Return the active textarea/input selection with offsets, if any. */
export function getActiveSelectionRange(): TextSelectionRange | null {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const { selectionStart, selectionEnd, value } = active;
    if (selectionStart != null && selectionEnd != null && selectionEnd > selectionStart) {
      return {
        text: value.slice(selectionStart, selectionEnd),
        start: selectionStart,
        end: selectionEnd,
      };
    }
  }
  const text = window.getSelection()?.toString() ?? "";
  if (!text) {
    return null;
  }
  return null;
}
