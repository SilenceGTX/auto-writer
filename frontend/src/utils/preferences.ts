/** Mapping between the preference sliders and raw sampling parameters.
 *
 * Implements the preset tiers from ``SYSTEM_SETTINGS_PAGE_DESIGN.md`` §4.1 so
 * the settings UI can offer friendly sliders while still persisting the raw
 * parameter values consumed by the LLM service.
 */
import type { StagePreference } from "../api";

export interface PreferenceLevel {
  label: string;
  values: Partial<StagePreference>;
}

export const CREATIVITY_LEVELS: PreferenceLevel[] = [
  { label: "保守", values: { temperature: 0.3, top_p: 0.8 } },
  { label: "平衡", values: { temperature: 0.7, top_p: 0.9 } },
  { label: "大胆", values: { temperature: 1.0, top_p: 0.95 } },
];

export const FOCUS_LEVELS: PreferenceLevel[] = [
  { label: "发散", values: { presence_penalty: 0.0, frequency_penalty: 0.0 } },
  { label: "适度", values: { presence_penalty: 0.3, frequency_penalty: 0.3 } },
  { label: "严谨", values: { presence_penalty: 0.6, frequency_penalty: 0.6 } },
];

export const LENGTH_LEVELS: PreferenceLevel[] = [
  { label: "精炼", values: { max_tokens: 512 } },
  { label: "标准", values: { max_tokens: 2048 } },
  { label: "详尽", values: { max_tokens: 4096 } },
];

/** Default stage preference matching the backend defaults. */
export const DEFAULT_STAGE_PREFERENCE: StagePreference = {
  temperature: 0.7,
  top_p: 0.9,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  max_tokens: 2048,
};

/** Default review-stage preference (more conservative than writing). */
export const DEFAULT_REVIEW_PREFERENCE: StagePreference = {
  temperature: 0.3,
  top_p: 0.85,
  presence_penalty: 0.3,
  frequency_penalty: 0.3,
  max_tokens: 2048,
};

/** Return the index of the level whose values all match the preference, or -1. */
export function detectLevel(levels: PreferenceLevel[], preference: StagePreference): number {
  return levels.findIndex((level) =>
    (Object.keys(level.values) as (keyof StagePreference)[]).every(
      (key) => preference[key] === level.values[key],
    ),
  );
}

/** Apply a level's preset values onto a preference, returning a new object. */
export function applyLevel(
  preference: StagePreference,
  level: PreferenceLevel,
): StagePreference {
  return { ...preference, ...level.values };
}
