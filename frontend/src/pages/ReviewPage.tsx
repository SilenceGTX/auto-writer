/** Review (审阅) page: read the finished manuscript and review it with AI.
 *
 * Implements ``designs/REVIEW_PAGE_DESIGN.md``: a reader (TOC / chapter
 * navigation / reading progress) in the workspace, and an editor-style AI review
 * chat in the assistant panel where the user can quote passages for checking.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { Download } from "lucide-react";
import { ApiError, downloadWorkChapterExport, getChapter, getOutline, type Chapter, type Outline } from "../api";
import { useApp } from "../context/AppContext";
import { useAssistant } from "../context/AssistantContext";
import { useToast } from "../components/Toast";
import { WorkTitleSelect } from "../components/WorkTitleSelect";
import { translateReviewApiError } from "../utils/reviewApiError";
import { ReviewReader } from "./review/ReviewReader";
import { ReviewAssistant } from "./review/ReviewAssistant";

/** Render the manuscript review workspace for the current work. */
export function ReviewPage(): ReactElement {
  const { t } = useTranslation(["review", "common", "errors"]);
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId, pendingHighlight, setPendingHighlight } = useApp();
  const { slot, setPageOwnsPanel, setCollapsed } = useAssistant();
  const [searchParams] = useSearchParams();
  const previousWorkIdRef = useRef<number | null>(currentWorkId);

  const [outline, setOutline] = useState<Outline | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
      notify(t("review:toast.loadChaptersFailed"), "error");
    }
  }, [currentWorkId, notify, searchParams, t]);

  useEffect(() => {
    void loadOutline();
  }, [loadOutline]);

  useEffect(() => {
    const previous = previousWorkIdRef.current;
    if (previous != null && previous !== currentWorkId) {
      navigate("/review", { replace: true });
      setSelectedId(null);
      setQuoted(null);
      setHighlight(null);
    }
    previousWorkIdRef.current = currentWorkId;
  }, [currentWorkId, navigate]);

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
        if (active) notify(t("review:toast.loadContentFailed"), "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, notify, t]);

  function handleQuote(text: string): void {
    setQuoted(text);
    setCollapsed(false);
  }

  function handleSelectChapter(chapterId: number): void {
    setHighlight(null);
    setSelectedId(chapterId);
  }

  async function handleExportChapters(): Promise<void> {
    if (currentWorkId == null) {
      return;
    }
    setExporting(true);
    try {
      await downloadWorkChapterExport(currentWorkId);
      notify(t("review:toast.exportStarted"), "success");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : null;
      notify(translateReviewApiError(message, t, "review:toast.exportFailed"), "error");
    } finally {
      setExporting(false);
    }
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>{t("review:page.title")}</h1>
          <p>{t("review:page.emptyWork.body")}</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            {t("review:page.emptyWork.goToWorks")}
          </Button>
        </div>
      </section>
    );
  }

  const chapters: Chapter[] = outline?.chapters ?? [];

  const assistantContent = (
    <ReviewAssistant
      key={selectedId ?? "none"}
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
          <WorkTitleSelect fallback={outline?.title ?? t("review:page.fallbackTitle")} />
          <p>{t("review:page.subtitle")}</p>
        </div>
        {chapters.length > 0 ? (
          <Button
            variant="flat"
            startContent={<Download size={16} />}
            isLoading={exporting}
            onPress={() => void handleExportChapters()}
          >
            {t("review:page.export")}
          </Button>
        ) : null}
      </div>

      {chapters.length === 0 ? (
        <div className="outline-empty">
          <p>{t("review:page.emptyChapters.body")}</p>
          <Button color="primary" onPress={() => navigate("/outline")}>
            {t("review:page.emptyChapters.goToOutline")}
          </Button>
        </div>
      ) : (
        <ReviewReader
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
