/** Review (审阅) page: read the finished manuscript and review it with AI.
 *
 * Implements ``designs/REVIEW_PAGE_DESIGN.md``: a reader (TOC / chapter
 * navigation / reading progress) in the workspace, and an editor-style AI review
 * chat in the assistant panel where the user can quote passages for checking.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { getChapter, getOutline, type Chapter, type Outline } from "../api";
import { useApp } from "../context/AppContext";
import { useAssistant } from "../context/AssistantContext";
import { useToast } from "../components/Toast";
import { ReviewReader } from "./review/ReviewReader";
import { ReviewAssistant } from "./review/ReviewAssistant";

/** Render the manuscript review workspace for the current work. */
export function ReviewPage(): ReactElement {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId, pendingHighlight, setPendingHighlight } = useApp();
  const { slot, setPageOwnsPanel, setCollapsed } = useAssistant();
  const [searchParams] = useSearchParams();

  const [outline, setOutline] = useState<Outline | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoted, setQuoted] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  // Pick up a "来源跳转" highlight request from the inspiration page (once).
  useEffect(() => {
    if (pendingHighlight != null) {
      setHighlight(pendingHighlight);
      setPendingHighlight(null);
    }
  }, [pendingHighlight, setPendingHighlight]);

  useEffect(() => {
    setPageOwnsPanel(true);
    return () => setPageOwnsPanel(false);
  }, [setPageOwnsPanel]);

  const loadOutline = useCallback(async () => {
    if (currentWorkId == null) {
      return;
    }
    try {
      const data = await getOutline(currentWorkId);
      setOutline(data);
      const requested = Number(searchParams.get("chapter"));
      const requestedExists = data.chapters.some((c) => c.id === requested);
      setSelectedId((current) =>
        requestedExists ? requested : (current ?? data.chapters[0]?.id ?? null),
      );
    } catch {
      notify("无法加载章节列表", "error");
    }
  }, [currentWorkId, notify, searchParams]);

  useEffect(() => {
    void loadOutline();
  }, [loadOutline]);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const chapter = await getChapter(selectedId);
        if (active) setContent(chapter.content ?? "");
      } catch {
        if (active) notify("无法加载章节正文", "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, notify]);

  function handleQuote(text: string): void {
    setQuoted(text);
    setCollapsed(false);
  }

  function handleSelectChapter(chapterId: number): void {
    setHighlight(null);
    setSelectedId(chapterId);
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>审阅</h1>
          <p>请先在作品页选择一个作品，再进入审阅。</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            前往作品页
          </Button>
        </div>
      </section>
    );
  }

  const chapters: Chapter[] = outline?.chapters ?? [];

  const assistantContent = (
    <ReviewAssistant
      workId={currentWorkId}
      chapterId={selectedId}
      quoted={quoted}
      onClearQuote={() => setQuoted(null)}
    />
  );

  return (
    <section className="workspace-page review-page">
      <div className="page-header">
        <div>
          <h1>{outline?.title ?? "审阅"}</h1>
          <p>通读全文，定位前后矛盾与可优化段落，并借助 AI 提出修改建议。</p>
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="outline-empty">
          <p>该作品还没有章节。请先在大纲页生成章节并完成写作后再来审阅。</p>
          <Button color="primary" onPress={() => navigate("/outline")}>
            前往大纲页
          </Button>
        </div>
      ) : (
        <ReviewReader
          workId={currentWorkId}
          chapters={chapters}
          selectedId={selectedId}
          onSelect={handleSelectChapter}
          title={outline?.title ?? null}
          content={content}
          loading={loading}
          highlight={highlight}
          onQuote={handleQuote}
        />
      )}

      {slot && createPortal(assistantContent, slot)}
    </section>
  );
}
