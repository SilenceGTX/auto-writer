/** Test the `@` mention search-and-insert behavior of MentionTextarea. */
import { useState, type ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldEntity } from "../api";
import { MentionTextarea } from "../components/MentionTextarea";

const sampleEntities = vi.hoisted(
  () =>
    [
      {
        id: 1,
        work_id: 1,
        category_id: 1,
        name: "张三",
        description: "主角",
        properties: [],
        sort_order: 1,
        created_at: "",
        updated_at: "",
      },
    ] as WorldEntity[],
);

vi.mock("../api", () => ({
  listEntities: vi.fn().mockResolvedValue({ items: sampleEntities, total: 1 }),
}));

/** Controlled wrapper exposing the current value for assertions. */
function Harness(): ReactElement {
  const [value, setValue] = useState("");
  return (
    <div>
      <MentionTextarea workId={1} label="概述" value={value} onValueChange={setValue} />
      <output data-testid="value">{value}</output>
    </div>
  );
}

describe("MentionTextarea", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the entity search on @ and inserts the chosen reference", async () => {
    render(<Harness />);
    const textarea = screen.getByLabelText("概述");

    await userEvent.type(textarea, "主角是@张");

    const option = await screen.findByRole("option", { name: /张三/ });
    await userEvent.click(option);

    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("主角是@张三"),
    );
  });
});
