/** Tests the reusable "加入灵感" button (selection capture + fallback + save). */
import "../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInspiration } from "../api";
import { AddInspirationButton } from "../components/AddInspirationButton";
import { ToastProvider } from "../components/Toast";

vi.mock("../api", () => ({
  createInspiration: vi.fn().mockResolvedValue({ id: 1 }),
}));

function renderButton(props: Parameters<typeof AddInspirationButton>[0]) {
  return render(
    <ToastProvider>
      <AddInspirationButton {...props} />
    </ToastProvider>,
  );
}

describe("AddInspirationButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the fallback text with its source references", async () => {
    renderButton({
      source: { source_page: "outline", work_id: 7, chapter_id: 3 },
      getFallbackText: () => "一个转折点",
    });

    await userEvent.click(screen.getByRole("button", { name: /加入灵感/ }));

    await waitFor(() =>
      expect(createInspiration).toHaveBeenCalledWith({
        content: "一个转折点",
        source_page: "outline",
        work_id: 7,
        chapter_id: 3,
      }),
    );
    expect(await screen.findByText("已加入灵感")).toBeInTheDocument();
  });

  it("warns and does not save when there is nothing to add", async () => {
    renderButton({ source: { source_page: "outline" }, getFallbackText: () => "  " });

    await userEvent.click(screen.getByRole("button", { name: /加入灵感/ }));

    expect(await screen.findByText("请先选择要加入灵感的文字")).toBeInTheDocument();
    expect(createInspiration).not.toHaveBeenCalled();
  });
});
