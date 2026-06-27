/** Tests for the outline stage-color and chapter-grouping helpers. */
import { describe, expect, it } from "vitest";
import type { Chapter, WorkStage } from "../api";
import {
  STAGE_COLORS,
  groupChaptersByStage,
  stageColor,
  stageColorMap,
  stageHeightPercent,
} from "../utils/outline";

function stage(id: number, sortOrder: number): WorkStage {
  return { id, work_id: 1, name: `S${id}`, overview: null, sort_order: sortOrder, chapter_count: 0 };
}

function chapter(id: number, stageId: number | null, number: number): Chapter {
  return {
    id,
    work_id: 1,
    stage_id: stageId,
    chapter_number: number,
    title: null,
    summary: null,
    word_count: 0,
    status: "草稿",
  };
}

describe("outline helpers", () => {
  it("assigns stable, cycling colors by index", () => {
    expect(stageColor(0)).toBe(STAGE_COLORS[0]);
    expect(stageColor(STAGE_COLORS.length)).toBe(STAGE_COLORS[0]);
    expect(stageColor(-1)).toBe("#94a3b8");
  });

  it("computes proportional heights with a minimum", () => {
    expect(stageHeightPercent(5, 10)).toBe(50);
    expect(stageHeightPercent(0, 10)).toBe(8);
    expect(stageHeightPercent(3, 0)).toBe(100);
  });

  it("groups chapters by stage id including unassigned", () => {
    const groups = groupChaptersByStage([
      chapter(1, 10, 1),
      chapter(2, 10, 2),
      chapter(3, null, 3),
    ]);
    expect(groups.get(10)).toHaveLength(2);
    expect(groups.get(null)).toHaveLength(1);
  });

  it("maps stage ids to palette colors by position", () => {
    const map = stageColorMap([stage(10, 0), stage(20, 1)]);
    expect(map.get(10)).toBe(STAGE_COLORS[0]);
    expect(map.get(20)).toBe(STAGE_COLORS[1]);
  });
});
