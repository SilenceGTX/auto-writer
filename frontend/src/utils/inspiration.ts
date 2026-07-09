/** Shared display helpers for inspiration cards and the detail modal. */
import type { TFunction } from "i18next";

const SOURCE_KEYS: Record<string, "outline" | "writing" | "review"> = {
  outline: "outline",
  writing: "writing",
  review: "review",
};

/** Map a stored source-page value to a localized label (or a fallback). */
export function sourceLabel(source: string | null, t: TFunction<"inspiration">): string {
  if (!source) {
    return t("sources.flash");
  }
  const key = SOURCE_KEYS[source];
  return key ? t(`sources.${key}`) : source;
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
