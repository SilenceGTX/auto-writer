/** Constants and helpers for multi-LLM profile management in settings UI. */

import i18n from "../i18n";
import type { LLMAssignments, LLMProfile } from "../api";

export const MAX_LLM_PROFILES = 5;

export const LLM_TASK_KEYS = [
  "outline_stages",
  "outline_chapters",
  "writing_draft",
  "writing_chat",
  "writing_rewrite",
  "review_chat",
] as const;

export type LLMTaskKey = (typeof LLM_TASK_KEYS)[number];

/** Return the localized label for an LLM task assignment key. */
export function llmTaskLabel(task: LLMTaskKey): string {
  return i18n.t(`settings:llmTasks.${task}`);
}

/** Create a new empty LLM profile with a generated id. */
export function createEmptyProfile(): LLMProfile {
  return {
    id: crypto.randomUUID(),
    url: "",
    api_token: "",
    model: "",
  };
}

/** Assign every task to the first profile in *profiles*. */
export function defaultAssignments(profiles: LLMProfile[]): LLMAssignments {
  const fallback = profiles[0]?.id ?? "";
  return {
    outline_stages: fallback,
    outline_chapters: fallback,
    writing_draft: fallback,
    writing_chat: fallback,
    writing_rewrite: fallback,
    review_chat: fallback,
  };
}

/** Re-point assignments that referenced a removed profile to *fallbackId*. */
export function fallbackAssignments(
  assignments: LLMAssignments,
  removedId: string,
  fallbackId: string,
): LLMAssignments {
  const next = { ...assignments };
  for (const key of LLM_TASK_KEYS) {
    if (next[key] === removedId) {
      next[key] = fallbackId;
    }
  }
  return next;
}

/** Return a display label for a profile, using model name with optional index. */
export function profileLabel(profile: LLMProfile, index: number): string {
  const name = profile.model.trim();
  return name || i18n.t("settings:connection.profileFallback", { index: index + 1 });
}
