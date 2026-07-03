/** Integration test for the inspiration page (card list, search, detail modal). */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inspiration, Tag } from "../api";
import { AppProvider } from "../context/AppContext";
import { ToastProvider } from "../components/Toast";
import { InspirationPage } from "../pages/InspirationPage";

const sampleTags = vi.hoisted(
  () => [{ id: 1, name: "转折", color: "#4f46e5" }] as Tag[],
);

const sampleInspirations = vi.hoisted(
  () =>
    [
      {
        id: 10,
        content: "一个关于背叛的转折",
        source_page: "outline",
        work_id: 1,
        chapter_id: null,
        created_at: "2026-06-01 10:00:00",
        tags: [{ id: 1, name: "转折", color: "#4f46e5" }],
      },
      {
        id: 11,
        content: "海上的灯塔意象",
        source_page: "writing",
        work_id: 1,
        chapter_id: 5,
        created_at: "2026-06-02 12:00:00",
        tags: [],
      },
    ] as Inspiration[],
);

vi.mock("../api", () => ({
  listInspirations: vi.fn().mockResolvedValue(sampleInspirations),
  listTags: vi.fn().mockResolvedValue(sampleTags),
  setInspirationTags: vi.fn(),
  createTag: vi.fn(),
  deleteInspiration: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AppProvider>
        <ToastProvider>
          <InspirationPage />
        </ToastProvider>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe("InspirationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders inspiration cards from the API", async () => {
    renderPage();
    expect(await screen.findByText("一个关于背叛的转折")).toBeInTheDocument();
    expect(screen.getByText("海上的灯塔意象")).toBeInTheDocument();
  });

  it("opens the detail modal with copy / insert-back / source-jump actions", async () => {
    renderPage();
    const card = await screen.findByText("一个关于背叛的转折");
    await userEvent.click(card);

    await waitFor(() => expect(screen.getByText("灵感详情")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /复制/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /回插到正文末尾/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /来源跳转/ })).toBeInTheDocument();
  });
});
