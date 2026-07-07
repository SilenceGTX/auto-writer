/** Tests the reusable "加入设定" button (selection capture, modal create, @ replace). */
import { useState, type ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroUIProvider } from "@heroui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEntity, listCategories } from "../api";
import { AddEntityButton } from "../components/AddEntityButton";
import { ToastProvider } from "../components/Toast";

const categories = [
  {
    id: 1,
    work_id: 1,
    name: "人物",
    is_preset: 1,
    sort_order: 1,
    entity_count: 0,
  },
  {
    id: 2,
    work_id: 1,
    name: "地点",
    is_preset: 1,
    sort_order: 2,
    entity_count: 0,
  },
];

const createdEntity = {
  id: 10,
  work_id: 1,
  category_id: 1,
  name: "机械神器",
  description: "",
  properties: [],
  sort_order: 1,
  created_at: "",
  updated_at: "",
};

vi.mock("../api", () => ({
  listCategories: vi.fn(),
  listPropertyNames: vi.fn().mockResolvedValue([]),
  createEntity: vi.fn(),
}));

function Harness(): ReactElement {
  const [text, setText] = useState("这是一个机械神器。");
  return (
    <HeroUIProvider>
      <ToastProvider>
        <textarea aria-label="概述" value={text} onChange={(event) => setText(event.target.value)} />
        <AddEntityButton workId={1} text={text} onTextChange={setText} />
        <output data-testid="value">{text}</output>
      </ToastProvider>
    </HeroUIProvider>
  );
}

describe("AddEntityButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCategories).mockResolvedValue(categories);
    vi.mocked(createEntity).mockResolvedValue(createdEntity);
  });

  it("warns when nothing is selected", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /加入设定/ }));
    expect(await screen.findByText("请先选择要加入设定的文字")).toBeInTheDocument();
    expect(listCategories).not.toHaveBeenCalled();
  });

  it("creates an entry and replaces the selection with an @ mention", async () => {
    render(<Harness />);
    const textarea = screen.getByLabelText("概述") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 8);

    const button = screen.getByRole("button", { name: /加入设定/ });
    fireEvent.mouseDown(button);
    await userEvent.click(button);

    expect(await screen.findByDisplayValue("机械神器")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "创建条目" }));

    await waitFor(() =>
      expect(createEntity).toHaveBeenCalledWith(1, {
        category_id: 1,
        name: "机械神器",
        description: "",
        properties: [],
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("这是一个@机械神器 。"),
    );
  });
});
