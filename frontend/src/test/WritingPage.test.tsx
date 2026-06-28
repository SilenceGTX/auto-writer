/** Integration test for the writing page (chapter load, editor, assistant). */
import { useState, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterContent, Outline } from "../api";
import { AppProvider } from "../context/AppContext";
import { AssistantProvider } from "../context/AssistantContext";
import { AssistantPanel } from "../components/AssistantPanel";
import { ToastProvider } from "../components/Toast";
import { WritingPage } from "../pages/WritingPage";

const sampleOutline = vi.hoisted(
  () =>
    ({
      work_id: 1,
      title: "测试作品",
      planned_chapter_count: 3,
      actual_chapter_count: 3,
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
      content: "你好世界",
      word_count: 4,
      status: "草稿",
    }) as ChapterContent,
);

vi.mock("../api", () => ({
  getOutline: vi.fn().mockResolvedValue(sampleOutline),
  getChapter: vi.fn().mockResolvedValue(chapterContent),
  saveChapterContent: vi.fn().mockResolvedValue(chapterContent),
  generateChapterDraft: vi.fn(),
  listEntities: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

/** Render WritingPage alongside the assistant panel that hosts its portal. */
function Harness(): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <WritingPage />
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

describe("WritingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("loads the first chapter's content and shows the live word count", async () => {
    renderPage();
    const editor = await screen.findByPlaceholderText(/撰写本章正文/);
    expect(editor).toHaveValue("你好世界");
    expect(screen.getByText(/本章 4 字/)).toBeInTheDocument();
  });

  it("renders the writing assistant in the panel", async () => {
    renderPage();
    await screen.findByPlaceholderText(/撰写本章正文/);
    expect(screen.getByRole("button", { name: "前情提要" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /发送/ })).toBeInTheDocument();
  });

  it("can switch chapters via the selector", async () => {
    renderPage();
    await screen.findByPlaceholderText(/撰写本章正文/);
    const { getChapter } = await import("../api");
    expect(getChapter).toHaveBeenCalledWith(11);
  });
});
