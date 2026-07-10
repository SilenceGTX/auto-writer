/** i18n helpers for preset story structures stored with Chinese stable keys (``seed.py``). */

import type { StoryStructure } from "../api";
import type { TFunction } from "i18next";

export const PRESET_STRUCTURE_NAMES = [
  "无",
  "三幕式",
  "起承转合",
  "英雄之旅",
  "斯奈德节拍表",
] as const;

export type PresetStructureName = (typeof PRESET_STRUCTURE_NAMES)[number];

const STRUCTURE_KEYS: Record<PresetStructureName, string> = {
  无: "none",
  三幕式: "three_act",
  起承转合: "kishotenketsu",
  英雄之旅: "hero_journey",
  斯奈德节拍表: "save_the_cat",
};

/** Canonical preset stage order (must match ``backend/app/services/seed.py``). */
export const PRESET_STAGE_NAMES: Record<string, readonly string[]> = {
  none: [],
  three_act: ["铺垫", "对抗", "解决"],
  kishotenketsu: ["开端", "发展", "转折", "结尾"],
  hero_journey: [
    "平凡世界",
    "冒险的召唤",
    "拒绝召唤",
    "遇见导师",
    "跨越第一道门槛",
    "考验、盟友与敌人",
    "接近深洞穴",
    "严峻考验",
    "获得奖赏",
    "返回之路",
    "复活与蜕变",
    "带着灵药归来",
  ],
  save_the_cat: [
    "开场画面",
    "主题陈述",
    "建立",
    "催化剂",
    "内心挣扎",
    "进入第二幕",
    "B 故事",
    "趣味与游戏",
    "中点",
    "坏蛋逼近",
    "一败涂地",
    "灵魂的黑夜",
    "进入第三幕",
    "结局",
    "终场画面",
  ],
};

/** Return whether *name* is a seeded preset structure label. */
export function isPresetStructureName(name: string): name is PresetStructureName {
  return name in STRUCTURE_KEYS;
}

/** Translate a preset structure name for display; custom names pass through. */
export function translatePresetStructureName(name: string, t: TFunction): string {
  const key = STRUCTURE_KEYS[name as PresetStructureName];
  if (!key) {
    return name;
  }
  return t(`works:structures.presets.${key}.name`);
}

/** Translate a preset stage label when *structureName* is a known preset. */
export function translatePresetStageName(
  structureName: string | null | undefined,
  stageName: string,
  t: TFunction,
): string {
  if (!structureName) {
    return stageName;
  }
  const structKey = STRUCTURE_KEYS[structureName as PresetStructureName];
  if (!structKey) {
    return stageName;
  }
  const canonical = PRESET_STAGE_NAMES[structKey];
  const index = canonical.indexOf(stageName);
  if (index === -1) {
    return stageName;
  }
  const stages = t(`works:structures.presets.${structKey}.stages`, { returnObjects: true });
  if (Array.isArray(stages) && typeof stages[index] === "string") {
    return stages[index];
  }
  return stageName;
}

/** Translate a structure row when it is a preset; otherwise return its stored name. */
export function translateStructureName(structure: StoryStructure, t: TFunction): string {
  if (structure.is_preset) {
    return translatePresetStructureName(structure.name, t);
  }
  return structure.name;
}
