/** Tests the outline "@" link-to-existing-entry button. */
import "../i18n";
import { useState, type ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroUIProvider } from "@heroui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEntities } from "../api";
import { LinkEntityButton } from "../components/LinkEntityButton";
import { ToastProvider } from "../components/Toast";

const baseEntity = {
  work_id: 1,
  category_id: 1,
  description: "",
  properties: [],
  sort_order: 1,
  created_at: "",
  updated_at: "",
};

vi.mock("../api", () => ({
  listEntities: vi.fn(),
}));

function Harness(): ReactElement {
  const [text, setText] = useState("这是一个机械神器。");
  return (
    <HeroUIProvider>
      <ToastProvider>
        <textarea aria-label="概述" value={text} onChange={(event) => setText(event.target.value)} />
        <LinkEntityButton workId={1} text={text} onTextChange={setText} />
        <output data-testid="value">{text}</output>
      </ToastProvider>
    </HeroUIProvider>
  );
}

describe("LinkEntityButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replaces the selection with an @ mention when exactly one entry matches", async () => {
    vi.mocked(listEntities).mockResolvedValue({
      items: [{ ...baseEntity, id: 1, name: "机械神器" }],
      total: 1,
    });
    render(<Harness />);
    const textarea = screen.getByLabelText("概述") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 8);

    const button = screen.getByRole("button", { name: /设定引用/ });
    fireEvent.mouseDown(button);
    await userEvent.click(button);

    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("这是一个@机械神器 。"),
    );
    expect(await screen.findByText("已添加设定引用")).toBeInTheDocument();
  });

  it("warns when no entry matches", async () => {
    vi.mocked(listEntities).mockResolvedValue({ items: [], total: 0 });
    render(<Harness />);
    const textarea = screen.getByLabelText("概述") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 8);

    const button = screen.getByRole("button", { name: /设定引用/ });
    fireEvent.mouseDown(button);
    await userEvent.click(button);

    expect(
      await screen.findByText("未找到名为「机械神器」的设定条目，可使用「+ 设定」新建"),
    ).toBeInTheDocument();
  });

  it("warns when multiple entries share the same name", async () => {
    vi.mocked(listEntities).mockResolvedValue({
      items: [
        { ...baseEntity, id: 1, name: "机械神器" },
        { ...baseEntity, id: 2, name: "机械神器" },
      ],
      total: 2,
    });
    render(<Harness />);
    const textarea = screen.getByLabelText("概述") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 8);

    const button = screen.getByRole("button", { name: /设定引用/ });
    fireEvent.mouseDown(button);
    await userEvent.click(button);

    expect(
      await screen.findByText("存在多个名为「机械神器」的设定条目，请先在设定页区分"),
    ).toBeInTheDocument();
  });

  it("warns when the selection already starts with @", async () => {
    function AtHarness(): ReactElement {
      const [text, setText] = useState("这是一个@机械神器 。");
      return (
        <HeroUIProvider>
          <ToastProvider>
            <textarea aria-label="概述" value={text} onChange={(event) => setText(event.target.value)} />
            <LinkEntityButton workId={1} text={text} onTextChange={setText} />
          </ToastProvider>
        </HeroUIProvider>
      );
    }
    render(<AtHarness />);
    const textarea = screen.getByLabelText("概述") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 9);

    const button = screen.getByRole("button", { name: /设定引用/ });
    fireEvent.mouseDown(button);
    await userEvent.click(button);

    expect(await screen.findByText("选中内容已是设定引用")).toBeInTheDocument();
    expect(listEntities).not.toHaveBeenCalled();
  });
});
