/** Tests for the work progress derivation helper (STORY_PAGE_DESIGN §4.3). */
import { describe, expect, it } from "vitest";
import type { Work } from "../api";
import { computeProgress } from "../utils/workProgress";

function makeWork(overrides: Partial<Work>): Work {
  return {
    id: 1,
    title: "示例",
    series_id: null,
    structure_id: null,
    series_name: null,
    structure_name: null,
    planned_chapter_count: null,
    actual_chapter_count: null,
    current_chapter: 0,
    total_word_count: 0,
    status: "创作中",
    summary: null,
    created_at: "2026-01-01 00:00:00",
    updated_at: "2026-01-01 00:00:00",
    ...overrides,
  };
}

describe("computeProgress", () => {
  it("reports 前期筹备 when no body writing has started", () => {
    const result = computeProgress(makeWork({ current_chapter: 0, actual_chapter_count: 20 }));
    expect(result.isPrep).toBe(true);
    expect(result.label).toBe("前期筹备");
    expect(result.percent).toBe(0);
  });

  it("reports 前期筹备 when the outline is not yet locked", () => {
    const result = computeProgress(makeWork({ current_chapter: 3, actual_chapter_count: null }));
    expect(result.isPrep).toBe(true);
  });

  it("computes the ratio and percentage once writing is underway", () => {
    const result = computeProgress(makeWork({ current_chapter: 3, actual_chapter_count: 10 }));
    expect(result.isPrep).toBe(false);
    expect(result.label).toBe("3/10");
    expect(result.percent).toBe(30);
  });

  it("caps the percentage at 100", () => {
    const result = computeProgress(makeWork({ current_chapter: 25, actual_chapter_count: 20 }));
    expect(result.percent).toBe(100);
  });
});
