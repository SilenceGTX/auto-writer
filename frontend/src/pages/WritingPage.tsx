/** Writing page: chapter selector + editor with AI collaboration.
 *
 * Implements ``designs/WRITING_PAGE_DESSIGN.md``: pick a chapter, edit its body
 * with autosave / undo-redo / live word count / focus mode / scroll memory,
 * generate a draft, collaborate via the assistant chat, summarize the previous
 * chapter (前情提要), and rewrite a selected passage with a diff preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Select, SelectItem } from "@heroui/react";
import {
  generateChapterDraft,
  getChapter,
  getOutline,
  getSettings,
  saveChapterContent,
  snapshotWork,
  type Chapter,
  type Outline,
} from "../api";
import { useApp } from "../context/AppContext";
import { useAssistant } from "../context/AssistantContext";
import { useToast } from "../components/Toast";
import { type SaveState } from "../components/SaveStatus";
import { WorkTitleSelect } from "../components/WorkTitleSelect";
import { useHotkeys } from "../hooks/useHotkeys";
import { countWords } from "../utils/wordCount";
import { translateWritingApiError } from "../utils/writingApiError";
import { ChapterEditor, type ScrollMemory } from "./writing/ChapterEditor";
import { RewriteDialog } from "./writing/RewriteDialog";
import { WritingAssistant } from "./writing/WritingAssistant";

const AUTOSAVE_DELAY_MS = 1500;

/** Render the writing workspace for the current work. */
export function WritingPage(): ReactElement {
  const { t } = useTranslation(["writing", "common", "errors"]);
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId, pendingInsert, setPendingInsert, pendingHighlight, setPendingHighlight } =
    useApp();
  const { slot, setPageOwnsPanel, setCollapsed, focusMode, setFocusMode } = useAssistant();
  const [searchParams] = useSearchParams();
  const previousWorkIdRef = useRef<number | null>(currentWorkId);

  const [outline, setOutline] = useState<Outline | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [contentLoaded, setContentLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [wordCounts, setWordCounts] = useState<Map<number, number>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [includeRecap, setIncludeRecap] = useState(false);
  const [quoted, setQuoted] = useState<string | null>(null);
  const [rewrite, setRewrite] = useState<{ selection: string; start: number; end: number } | null>(
    null,
  );

  const savedContentRef = useRef("");
  const contentRef = useRef(content);
  contentRef.current = content;
  const memoryRef = useRef<Map<number, ScrollMemory>>(new Map());
  const lastSnapshotRef = useRef("");
  const [autosaveIntervalMs, setAutosaveIntervalMs] = useState(30000);

  useEffect(() => {
    void getSettings()
      .then((s) => setAutosaveIntervalMs(s.data_save.autosave_interval_seconds * 1000))
      .catch(() => undefined);
  }, []);

  // Second auto-save layer: on the configured interval, mirror the work to disk
  // as a snapshot when its persisted content has changed since the last one.
  useEffect(() => {
    if (currentWorkId == null) {
      return;
    }
    const timer = window.setInterval(() => {
      if (savedContentRef.current === lastSnapshotRef.current) {
        return;
      }
      lastSnapshotRef.current = savedContentRef.current;
      void snapshotWork(currentWorkId).catch(() => undefined);
    }, autosaveIntervalMs);
    return () => window.clearInterval(timer);
  }, [currentWorkId, autosaveIntervalMs]);

  useEffect(() => {
    setPageOwnsPanel(true);
    return () => {
      setPageOwnsPanel(false);
      setFocusMode(false);
    };
  }, [setPageOwnsPanel, setFocusMode]);

  const loadOutline = useCallback(async () => {
    if (currentWorkId == null) {
      return;
    }
    try {
      const data = await getOutline(currentWorkId);
      setOutline(data);
      setWordCounts(new Map(data.chapters.map((c) => [c.id, c.word_count])));
      const requested = Number(searchParams.get("chapter"));
      const requestedExists = data.chapters.some((c) => c.id === requested);
      setSelectedId((current) =>
        requestedExists ? requested : (current ?? data.chapters[0]?.id ?? null),
      );
    } catch {
      notify(t("writing:toast.loadChaptersFailed"), "error");
    }
  }, [currentWorkId, notify, searchParams, t]);

  useEffect(() => {
    void loadOutline();
  }, [loadOutline]);

  useEffect(() => {
    const previous = previousWorkIdRef.current;
    if (previous != null && previous !== currentWorkId) {
      navigate("/writing", { replace: true });
      setSelectedId(null);
    }
    previousWorkIdRef.current = currentWorkId;
  }, [currentWorkId, navigate]);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }
    let active = true;
    setContentLoaded(false);
    void (async () => {
      try {
        const chapter = await getChapter(selectedId);
        if (!active) return;
        savedContentRef.current = chapter.content ?? "";
        setContent(chapter.content ?? "");
        setSaveState("idle");
        setWordCounts((current) => new Map(current).set(chapter.id, chapter.word_count));
        setContentLoaded(true);
      } catch {
        if (active) notify(t("writing:toast.loadContentFailed"), "error");
      }
    })();
    return () => {
      active = false;
      const text = contentRef.current;
      if (text !== savedContentRef.current) {
        void saveChapterContent(selectedId, text)
          .then((saved) => {
            savedContentRef.current = saved.content ?? "";
          })
          .catch(() => undefined);
      }
    };
  }, [selectedId, notify, t]);

  // Consume a queued "一键回插" from the inspiration page: append the snippet to
  // the end of the current chapter's body once its content is loaded, then ask
  // the editor to highlight the inserted text so the result is unambiguous.
  useEffect(() => {
    if (pendingInsert == null || selectedId == null || !contentLoaded) {
      return;
    }
    const snippet = pendingInsert;
    setContent((current) => (current.trim() ? `${current}\n\n${snippet}` : snippet));
    setPendingInsert(null);
    setPendingHighlight(snippet);
    notify(t("writing:toast.inserted"), "success");
  }, [
    pendingInsert,
    selectedId,
    contentLoaded,
    setPendingInsert,
    setPendingHighlight,
    notify,
    t,
  ]);

  const persist = useCallback(async (): Promise<void> => {
    if (selectedId == null || content === savedContentRef.current) {
      return;
    }
    setSaveState("saving");
    try {
      const saved = await saveChapterContent(selectedId, content);
      savedContentRef.current = saved.content ?? "";
      setWordCounts((current) => new Map(current).set(saved.id, saved.word_count));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [selectedId, content]);

  const flushPendingSave = useCallback((): void => {
    const id = selectedId;
    const text = contentRef.current;
    if (id == null || text === savedContentRef.current) {
      return;
    }
    void saveChapterContent(id, text)
      .then((saved) => {
        savedContentRef.current = saved.content ?? "";
      })
      .catch(() => undefined);
  }, [selectedId]);

  useEffect(() => {
    const handlePageHide = (): void => {
      flushPendingSave();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  useEffect(() => {
    if (selectedId == null || content === savedContentRef.current) {
      return;
    }
    const timer = window.setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [content, selectedId, persist]);

  useHotkeys(useMemo(() => ({ "mod+s": () => void persist() }), [persist]));

  const totalWordCount = useMemo(() => {
    let total = 0;
    for (const [id, count] of wordCounts) {
      total += id === selectedId ? countWords(content) : count;
    }
    return total;
  }, [wordCounts, selectedId, content]);

  async function handleGenerateDraft(): Promise<void> {
    if (selectedId == null) return;
    setGenerating(true);
    try {
      const chapter = await generateChapterDraft(selectedId, includeRecap);
      savedContentRef.current = chapter.content ?? "";
      setContent(chapter.content ?? "");
      setWordCounts((current) => new Map(current).set(chapter.id, chapter.word_count));
      setSaveState("saved");
      notify(t("writing:toast.draftGenerated"), "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(
        translateWritingApiError(message, t, "writing:toast.generateDraftFailed"),
        "error",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleQuote(text: string): void {
    setQuoted(text);
    setCollapsed(false);
    setFocusMode(false);
  }

  function applyRewrite(rewritten: string): void {
    if (!rewrite) return;
    setContent((current) => current.slice(0, rewrite.start) + rewritten + current.slice(rewrite.end));
    setRewrite(null);
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>{t("writing:page.title")}</h1>
          <p>{t("writing:page.emptyWork.body")}</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            {t("writing:page.emptyWork.goToWorks")}
          </Button>
        </div>
      </section>
    );
  }

  const chapters = outline?.chapters ?? [];
  const selectedChapter = chapters.find((c) => c.id === selectedId);

  const assistantContent =
    selectedId != null ? (
      <WritingAssistant
        key={selectedId}
        workId={currentWorkId}
        chapterId={selectedId}
        quoted={quoted}
        onClearQuote={() => setQuoted(null)}
      />
    ) : (
      <section className="assistant-section">
        <h2>{t("writing:page.assistantIdleTitle")}</h2>
        <p className="assistant-hint">{t("writing:page.assistantIdleHint")}</p>
      </section>
    );

  return (
    <section className="workspace-page writing-page">
      <div className="page-header">
        <div>
          <WorkTitleSelect fallback={outline?.title ?? t("writing:page.fallbackTitle")} />
          <p>{t("writing:page.subtitle")}</p>
        </div>
        <Select
          aria-label={t("writing:page.chapterSelectAria")}
          className="chapter-picker"
          selectedKeys={selectedId != null ? [String(selectedId)] : []}
          isDisabled={chapters.length === 0}
          placeholder={t("writing:page.chapterSelectPlaceholder")}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) setSelectedId(Number(key));
          }}
        >
          {chapters.map((chapter: Chapter) => (
            <SelectItem key={String(chapter.id)}>
              {`${t("writing:page.chapterOption", { number: chapter.chapter_number })}${
                chapter.title ? ` · ${chapter.title}` : ""
              }`}
            </SelectItem>
          ))}
        </Select>
      </div>

      {chapters.length === 0 ? (
        <div className="outline-empty">
          <p>{t("writing:page.emptyChapters.body")}</p>
          <Button color="primary" onPress={() => navigate("/outline")}>
            {t("writing:page.emptyChapters.goToOutline")}
          </Button>
        </div>
      ) : selectedId != null ? (
        <ChapterEditor
          key={selectedId}
          workId={currentWorkId}
          chapterId={selectedId}
          value={content}
          onValueChange={setContent}
          saveState={saveState}
          totalWordCount={totalWordCount}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode(!focusMode)}
          generating={generating}
          onGenerateDraft={() => void handleGenerateDraft()}
          includeRecap={includeRecap}
          onIncludeRecapChange={setIncludeRecap}
          onQuote={handleQuote}
          onRewrite={(selection, start, end) => setRewrite({ selection, start, end })}
          memory={memoryRef.current}
          highlight={contentLoaded ? pendingHighlight : null}
          onHighlightConsumed={() => setPendingHighlight(null)}
        />
      ) : null}

      {slot && createPortal(assistantContent, slot)}

      {rewrite && selectedId != null && (
        <RewriteDialog
          isOpen
          chapterId={selectedId}
          selection={rewrite.selection}
          context={selectedChapter?.summary ?? undefined}
          content={content}
          selectionStart={rewrite.start}
          selectionEnd={rewrite.end}
          onApply={applyRewrite}
          onClose={() => setRewrite(null)}
        />
      )}
    </section>
  );
}
