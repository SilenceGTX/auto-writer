/** Tests for preset worldbuilding category display helpers. */
import "../i18n";
import i18n from "../i18n";
import { describe, expect, it, beforeEach } from "vitest";
import { translateCategoryName } from "../utils/entityCategoryI18n";

describe("entityCategoryI18n", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates preset categories", () => {
    const t = i18n.getFixedT("en", "concept");
    expect(
      translateCategoryName(
        { id: 1, work_id: 1, name: "人物", is_preset: 1, sort_order: 0, entity_count: 0 },
        t,
      ),
    ).toBe("Characters");
    expect(
      translateCategoryName(
        { id: 2, work_id: 1, name: "概念", is_preset: 1, sort_order: 3, entity_count: 0 },
        t,
      ),
    ).toBe("Concepts");
  });

  it("passes through custom categories", () => {
    const t = i18n.getFixedT("en", "concept");
    expect(
      translateCategoryName(
        { id: 3, work_id: 1, name: "组织", is_preset: 0, sort_order: 2, entity_count: 0 },
        t,
      ),
    ).toBe("组织");
  });
});
