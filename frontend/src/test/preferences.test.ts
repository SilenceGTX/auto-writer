/** Tests for the preference level-mapping helpers. */
import { describe, expect, it } from "vitest";
import type { StagePreference } from "../api";
import {
  CREATIVITY_LEVELS,
  DEFAULT_STAGE_PREFERENCE,
  FOCUS_LEVELS,
  LENGTH_LEVELS,
  applyLevel,
  detectLevel,
} from "../utils/preferences";

describe("preferences", () => {
  it("detects the matching creativity level from default params", () => {
    expect(detectLevel(CREATIVITY_LEVELS, DEFAULT_STAGE_PREFERENCE)).toBe(1);
  });

  it("returns -1 when no level matches", () => {
    const custom: StagePreference = { ...DEFAULT_STAGE_PREFERENCE, temperature: 0.55 };
    expect(detectLevel(CREATIVITY_LEVELS, custom)).toBe(-1);
  });

  it("applies a level's preset values without touching others", () => {
    const next = applyLevel(DEFAULT_STAGE_PREFERENCE, CREATIVITY_LEVELS[0]);
    expect(next.temperature).toBe(0.3);
    expect(next.top_p).toBe(0.8);
    expect(next.presence_penalty).toBe(DEFAULT_STAGE_PREFERENCE.presence_penalty);
  });

  it("maps focus and length presets to their parameters", () => {
    const strict = applyLevel(DEFAULT_STAGE_PREFERENCE, FOCUS_LEVELS[2]);
    expect(strict.presence_penalty).toBe(0.6);
    expect(strict.frequency_penalty).toBe(0.6);

    const concise = applyLevel(DEFAULT_STAGE_PREFERENCE, LENGTH_LEVELS[0]);
    expect(concise.max_tokens).toBe(2048);
    expect(LENGTH_LEVELS[2].values.max_tokens).toBe(16384);
    expect(DEFAULT_STAGE_PREFERENCE.max_tokens).toBe(4096);
  });
});
