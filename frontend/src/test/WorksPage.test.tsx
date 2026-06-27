/** Integration test for the works list rendering (table, progress, search). */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "../api";
import { AppProvider } from "../context/AppContext";
import { AssistantProvider } from "../context/AssistantContext";
import { ToastProvider } from "../components/Toast";
import { WorksPage } from "../pages/WorksPage";

const sampleWorks = vi.hoisted(() => {
  const base = {
    id: 1,
    title: "示例",
    series_id: null,
    structure_id: null,
    series_name: null,
    structure_name: null,
    planned_chapter_count: null,
    actual_chapter_count: null,
    current_chapter: 0,
    total_word_count: 0,
    status: "创作中",
    summary: null,
    created_at: "2026-01-01 00:00:00",
    updated_at: "2026-01-02 00:00:00",
  };
  return [
    { ...base, id: 1, title: "前期作品", current_chapter: 0 },
    {
      ...base,
      id: 2,
      title: "进行中作品",
      series_name: "玄幻系列",
      current_chapter: 3,
      actual_chapter_count: 10,
    },
  ] as Work[];
});

vi.mock("../api", () => ({
  listWorks: vi.fn().mockResolvedValue({ items: sampleWorks, total: 2 }),
  listSeries: vi.fn().mockResolvedValue([]),
  listStructures: vi.fn().mockResolvedValue([]),
  updateWork: vi.fn(),
  deleteWork: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AppProvider>
        <AssistantProvider>
          <ToastProvider>
            <WorksPage />
          </ToastProvider>
        </AssistantProvider>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe("WorksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders works with series names and progress states", async () => {
    renderPage();

    expect(await screen.findByText("前期作品")).toBeInTheDocument();
    expect(screen.getByText("进行中作品")).toBeInTheDocument();
    expect(screen.getByText("玄幻系列")).toBeInTheDocument();
    expect(screen.getByText("前期筹备")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
  });

  it("exposes the new-work action", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("前期作品")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "新建作品" })).toBeInTheDocument();
  });
});
