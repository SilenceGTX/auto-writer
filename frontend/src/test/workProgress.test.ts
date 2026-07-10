/** Tests for the work progress derivation helper. */
import { describe, expect, it } from "vitest";
import type { Work } from "../api";
import { computeProgress, progressTotalChapters } from "../utils/workProgress";

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
    written_chapter_count: 0,
    chapter_count: 0,
    total_word_count: 0,
    status: "创作中",
    summary: null,
    created_at: "2026-01-01 00:00:00",
    updated_at: "2026-01-01 00:00:00",
    ...overrides,
  };
}

describe("computeProgress", () => {
  it("reports prep state when no chapter has body text", () => {
    const result = computeProgress(
      makeWork({ actual_chapter_count: 20, chapter_count: 20, written_chapter_count: 0 }),
    );
    expect(result.isPrep).toBe(true);
    expect(result.label).toBe("");
    expect(result.percent).toBe(0);
  });

  it("uses written chapters over total once body writing has started", () => {
    const result = computeProgress(
      makeWork({ actual_chapter_count: 10, chapter_count: 10, written_chapter_count: 3 }),
    );
    expect(result.isPrep).toBe(false);
    expect(result.label).toBe("3/10");
    expect(result.percent).toBe(30);
  });

  it("falls back to planned or chapter_count for the denominator", () => {
    expect(progressTotalChapters(makeWork({ planned_chapter_count: 8, chapter_count: 5 }))).toBe(8);
    expect(progressTotalChapters(makeWork({ planned_chapter_count: null, chapter_count: 5 }))).toBe(5);
  });

  it("caps the percentage at 100", () => {
    const result = computeProgress(
      makeWork({ actual_chapter_count: 5, written_chapter_count: 7, chapter_count: 7 }),
    );
    expect(result.percent).toBe(100);
  });

  it("shows written count alone when total chapters are unknown", () => {
    const result = computeProgress(makeWork({ written_chapter_count: 2, total_word_count: 500 }));
    expect(result.label).toBe("2");
    expect(result.isPrep).toBe(false);
  });
});
