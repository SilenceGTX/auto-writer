/** Helpers for stored chapter status values and localized display labels. */

export const CHAPTER_STATUS_VALUES = ["草稿", "已完成"] as const;

export type ChapterStatusValue = (typeof CHAPTER_STATUS_VALUES)[number];

const STATUS_I18N_KEYS: Record<ChapterStatusValue, string> = {
  草稿: "outline:chapterStatus.draft",
  已完成: "outline:chapterStatus.completed",
};

/** Return the i18n key for a stored chapter status, or the raw value if unknown. */
export function chapterStatusLabelKey(status: string): string {
  return STATUS_I18N_KEYS[status as ChapterStatusValue] ?? status;
}

/** Whether the chapter is in the completed status stored by the backend. */
export function isChapterCompleted(status: string): boolean {
  return status === "已完成";
}
