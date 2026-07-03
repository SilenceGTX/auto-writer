/** Helpers for rendering the outline stage tree (colors and block heights).
 *
 * Each stage gets a stable color (reused on chapter cards) and a block height
 * proportional to its share of chapters, per ``OUTLINE_PAGE_DESIGN.md`` §2.1.
 */
import type { Chapter, WorkStage } from "../api";

export const STAGE_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

const UNASSIGNED_COLOR = "#94a3b8";

/** Return the color for a stage by its position (stable, cycles the palette). */
export function stageColor(index: number): string {
  if (index < 0) {
    return UNASSIGNED_COLOR;
  }
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

/** Compute a stage block height percentage (min 8%) from its chapter share. */
export function stageHeightPercent(chapterCount: number, maxChapterCount: number): number {
  if (maxChapterCount <= 0) {
    return 100;
  }
  return Math.max(8, Math.round((chapterCount / maxChapterCount) * 100));
}

/** Group chapters by their stage id (null key holds unassigned chapters). */
export function groupChaptersByStage(chapters: Chapter[]): Map<number | null, Chapter[]> {
  const groups = new Map<number | null, Chapter[]>();
  for (const chapter of chapters) {
    const list = groups.get(chapter.stage_id) ?? [];
    list.push(chapter);
    groups.set(chapter.stage_id, list);
  }
  return groups;
}

/** Build a stable map from stage id to its palette index for coloring. */
export function stageColorMap(stages: WorkStage[]): Map<number, string> {
  return new Map(stages.map((stage, index) => [stage.id, stageColor(index)]));
}
