/** Tests for preset story structure display helpers. */
import "../i18n";
import i18n from "../i18n";
import { describe, expect, it, beforeEach } from "vitest";
import {
  translatePresetStageName,
  translatePresetStructureName,
} from "../utils/storyStructureI18n";

describe("storyStructureI18n", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates preset structure names", () => {
    const t = i18n.getFixedT("en", "works");
    expect(translatePresetStructureName("三幕式", t)).toBe("Three-act structure");
    expect(translatePresetStructureName("无", t)).toBe("None");
  });

  it("translates preset stage names by structure", () => {
    const t = i18n.getFixedT("en", "works");
    expect(translatePresetStageName("三幕式", "铺垫", t)).toBe("Setup");
    expect(translatePresetStageName("斯奈德节拍表", "终场画面", t)).toBe("Final Image");
  });

  it("passes through unknown custom names", () => {
    const t = i18n.getFixedT("en", "works");
    expect(translatePresetStructureName("我的结构", t)).toBe("我的结构");
    expect(translatePresetStageName("我的结构", "第一章", t)).toBe("第一章");
  });
});
