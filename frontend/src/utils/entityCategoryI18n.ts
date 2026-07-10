/** i18n helpers for preset worldbuilding categories (``seed.py`` / ``DEFAULT_ENTITY_CATEGORIES``). */

import type { EntityCategory } from "../api";
import type { TFunction } from "i18next";

export const PRESET_CATEGORY_NAMES = ["人物", "地点", "物品", "概念"] as const;

export type PresetCategoryName = (typeof PRESET_CATEGORY_NAMES)[number];

const CATEGORY_KEYS: Record<PresetCategoryName, string> = {
  人物: "characters",
  地点: "locations",
  物品: "items",
  概念: "concepts",
};

/** Return whether *name* is a seeded preset category label. */
export function isPresetCategoryName(name: string): name is PresetCategoryName {
  return name in CATEGORY_KEYS;
}

/** Translate a preset category name for display; custom names pass through. */
export function translateCategoryName(category: EntityCategory, t: TFunction<"concept">): string {
  if (category.is_preset !== 1 || !isPresetCategoryName(category.name)) {
    return category.name;
  }
  return t(`categories.presets.${CATEGORY_KEYS[category.name]}`);
}

/** Translate a category label when only the stored name is available. */
export function translateCategoryNameByLabel(name: string, t: TFunction<"concept">): string {
  if (!isPresetCategoryName(name)) {
    return name;
  }
  return t(`categories.presets.${CATEGORY_KEYS[name]}`);
}
