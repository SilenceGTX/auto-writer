/** Helpers for reading the user's current text selection across inputs and DOM.
 *
 * Supports the global "加入灵感" action (``GENERAL_UI_DESIGN.md`` G3): a snippet
 * may be selected inside a textarea/input (where ``window.getSelection`` returns
 * nothing) or in rendered page content. This unifies both cases.
 */

/** Return the currently selected text from the active input or page selection. */
export function getActiveSelectionText(): string {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const { selectionStart, selectionEnd, value } = active;
    if (selectionStart != null && selectionEnd != null && selectionEnd > selectionStart) {
      return value.slice(selectionStart, selectionEnd);
    }
  }
  return window.getSelection()?.toString() ?? "";
}
