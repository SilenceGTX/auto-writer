/** Pure helpers for deriving a work's writing progress for display.
 *
 * Encapsulates the progress rules from ``designs/STORY_PAGE_DESIGN.md`` §4.3 so
 * the works list and detail panel render progress consistently.
 */
import type { Work } from "../api";

export interface WorkProgress {
  /** True when the work has not started body writing yet ("前期筹备"). */
  isPrep: boolean;
  /** The current writing chapter. */
  current: number;
  /** Total planned chapters, or null when still in preparation. */
  total: number | null;
  /** Completion percentage in the range [0, 100]. */
  percent: number;
  /** Human-readable progress label, e.g. "3/20" or "前期筹备". */
  label: string;
}

/** Derive the display progress for a work following the design's rules. */
export function computeProgress(work: Work): WorkProgress {
  const isPrep = work.current_chapter <= 0 || work.actual_chapter_count == null;
  if (isPrep) {
    return { isPrep: true, current: work.current_chapter, total: null, percent: 0, label: "前期筹备" };
  }

  const total = work.actual_chapter_count ?? work.planned_chapter_count ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((work.current_chapter / total) * 100)) : 0;
  return {
    isPrep: false,
    current: work.current_chapter,
    total,
    percent,
    label: `${work.current_chapter}/${total}`,
  };
}
