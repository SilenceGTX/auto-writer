/** Helpers for normalizing FastAPI / backend error payloads into display strings. */

/** Extract a human-readable detail from a raw HTTP error body. */
export function extractApiErrorMessage(raw: string, status: number): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return `HTTP ${status}`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .filter(Boolean)
        .join("; ");
    }
  } catch {
    // Not JSON — use the raw body.
  }
  return trimmed;
}
