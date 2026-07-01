/** Shared display helpers for inspiration cards and the detail modal. */

/** Human-readable label for an inspiration's source page. */
export const SOURCE_LABELS: Record<string, string> = {
  outline: "大纲",
  writing: "写作",
  review: "审阅",
};

/** Map a stored source-page value to its Chinese label (or a fallback). */
export function sourceLabel(source: string | null): string {
  return source ? (SOURCE_LABELS[source] ?? source) : "未知来源";
}

/** Format an ISO-like UTC timestamp ("YYYY-MM-DD HH:MM:SS") for display. */
export function formatTimestamp(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
