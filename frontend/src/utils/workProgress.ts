/** Pure helpers for deriving a work's writing progress for display.
 *
 * Progress is based on chapters that already have body text (``written_chapter_count``)
 * over the work's total chapter count. ``前期筹备`` means no chapter has body text yet.
 */
import type { Work } from "../api";

export interface WorkProgress {
  /** True when no chapter has body text yet ("前期筹备"). */
  isPrep: boolean;
  /** Chapters with non-empty body text. */
  written: number;
  /** Total chapters used as the denominator. */
  total: number;
  /** Completion percentage in the range [0, 100]. */
  percent: number;
  /** Human-readable progress label, e.g. "3/20". Empty when ``isPrep`` is true. */
  label: string;
}

/** Resolve the chapter total used as the progress denominator. */
export function progressTotalChapters(work: Work): number {
  return work.actual_chapter_count ?? work.planned_chapter_count ?? work.chapter_count ?? 0;
}

/** Derive the display progress for a work. */
export function computeProgress(work: Work): WorkProgress {
  const written = work.written_chapter_count ?? 0;
  const total = progressTotalChapters(work);

  if (written <= 0) {
    return { isPrep: true, written: 0, total, percent: 0, label: "" };
  }

  const percent = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
  return {
    isPrep: false,
    written,
    total,
    percent,
    label: total > 0 ? `${written}/${total}` : `${written}`,
  };
}
