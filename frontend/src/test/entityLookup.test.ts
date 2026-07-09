/** Tests for exact-name entity lookup. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEntities } from "../api";
import { findEntitiesByExactName } from "../utils/entityLookup";

vi.mock("../api", () => ({
  listEntities: vi.fn(),
}));

const baseEntity = {
  id: 1,
  work_id: 1,
  category_id: 1,
  description: "",
  properties: [],
  sort_order: 1,
  created_at: "",
  updated_at: "",
};

describe("findEntitiesByExactName", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only entries with an exact name match", async () => {
    vi.mocked(listEntities).mockResolvedValue({
      items: [
        { ...baseEntity, id: 1, name: "机械神器" },
        { ...baseEntity, id: 2, name: "李机械神器" },
      ],
      total: 2,
    });
    const matches = await findEntitiesByExactName(1, "机械神器");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("机械神器");
  });
});
