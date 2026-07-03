/** Global keyboard shortcut hook (rule G8).

Binds combos to handlers on the document. Combos use the `mod` token to mean
Ctrl on Windows/Linux and Cmd on macOS, e.g. `mod+s`, `mod+k`, `mod+shift+z`.
*/
import { useEffect } from "react";

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

/** Normalize a KeyboardEvent into a `mod+...` combo string. */
export function eventToCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("mod");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}

/** Register global keyboard shortcuts for the lifetime of the component. */
export function useHotkeys(map: HotkeyMap): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const handler = map[eventToCombo(event)];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [map]);
}
