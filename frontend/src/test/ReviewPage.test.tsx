/** Integration test for the review page (reader, TOC, assistant). */
import { useState, type ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterContent, Outline } from "../api";
import { AppProvider } from "../context/AppContext";
import { AssistantProvider } from "../context/AssistantContext";
import { AssistantPanel } from "../components/AssistantPanel";
import { ToastProvider } from "../components/Toast";
import { ReviewPage } from "../pages/ReviewPage";

const sampleOutline = vi.hoisted(
  () =>
    ({
      work_id: 1,
      title: "测试作品",
      planned_chapter_count: 2,
      actual_chapter_count: 2,
      structure_name: "三幕式",
      locked: true,
      stages: [],
      chapters: [
        {
          id: 11,
          work_id: 1,
          stage_id: null,
          chapter_number: 1,
          title: "开端",
          summary: "主角登场",
          word_count: 4,
          status: "草稿",
        },
        {
          id: 12,
          work_id: 1,
          stage_id: null,
          chapter_number: 2,
          title: "发展",
          summary: "冲突升级",
          word_count: 0,
          status: "草稿",
        },
      ],
    }) as Outline,
);

const chapterContent = vi.hoisted(
  () =>
    ({
      id: 11,
      work_id: 1,
      chapter_number: 1,
      title: "开端",
      summary: "主角登场",
      content: "这是第一章的正文段落。",
      word_count: 10,
      status: "草稿",
    }) as ChapterContent,
);

vi.mock("../api", () => ({
  getOutline: vi.fn().mockResolvedValue(sampleOutline),
  getChapter: vi.fn().mockResolvedValue(chapterContent),
  getReviewChatMessages: vi.fn().mockResolvedValue([]),
  clearReviewChatMemory: vi.fn().mockResolvedValue(undefined),
  sendReviewChat: vi.fn(),
  listEntities: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  downloadWorkChapterExport: vi.fn().mockResolvedValue(undefined),
}));

function Harness(): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <ReviewPage />
      <AssistantPanel collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
    </div>
  );
}

function renderPage() {
  localStorage.setItem("aw.currentWorkId", "1");
  return render(
    <MemoryRouter>
      <AppProvider>
        <AssistantProvider>
          <ToastProvider>
            <Harness />
          </ToastProvider>
        </AssistantProvider>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe("ReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the table of contents and the first chapter's text", async () => {
    renderPage();
    expect(await screen.findByText("这是第一章的正文段落。")).toBeInTheDocument();
    expect(screen.getByText(/第 1 \/ 2 章/)).toBeInTheDocument();
  });

  it("renders the review assistant in the panel", async () => {
    renderPage();
    await screen.findByText("这是第一章的正文段落。");
    expect(screen.getByRole("heading", { name: "审阅助手" })).toBeInTheDocument();
  });

  it("loads another chapter when selected from the TOC", async () => {
    renderPage();
    await screen.findByText("这是第一章的正文段落。");
    const { getChapter } = await import("../api");
    const second = screen.getAllByText(/第 2 章/)[0];
    await userEvent.click(second);
    await waitFor(() => expect(getChapter).toHaveBeenCalledWith(12));
  });

  it("exports chapters when the export button is clicked", async () => {
    renderPage();
    await screen.findByText("这是第一章的正文段落。");
    const { downloadWorkChapterExport } = await import("../api");
    await userEvent.click(screen.getByRole("button", { name: "导出作品" }));
    await waitFor(() => expect(downloadWorkChapterExport).toHaveBeenCalledWith(1));
  });
});
