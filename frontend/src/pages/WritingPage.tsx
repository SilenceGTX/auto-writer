/** Writing page: chapter selector + editor with AI collaboration.
 *
 * Implements ``designs/WRITING_PAGE_DESSIGN.md``: pick a chapter, edit its body
 * with autosave / undo-redo / live word count / focus mode / scroll memory,
 * generate a draft, collaborate via the assistant chat, summarize the previous
 * chapter (前情提要), and rewrite a selected passage with a diff preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
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
import { useHotkeys } from "../hooks/useHotkeys";
import { countWords } from "../utils/wordCount";
import { ChapterEditor, type ScrollMemory } from "./writing/ChapterEditor";
import { RewriteDialog } from "./writing/RewriteDialog";
import { WritingAssistant } from "./writing/WritingAssistant";

const AUTOSAVE_DELAY_MS = 1500;

/** Render the writing workspace for the current work. */
export function WritingPage(): ReactElement {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId, pendingInsert, setPendingInsert, pendingHighlight, setPendingHighlight } =
    useApp();
  const { slot, setPageOwnsPanel, setCollapsed, focusMode, setFocusMode } = useAssistant();
  const [searchParams] = useSearchParams();

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
        if (active) notify("无法加载章节正文", "error");
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId, notify]);

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
    notify("已插入到本章正文末尾", "success");
  }, [pendingInsert, selectedId, contentLoaded, setPendingInsert, setPendingHighlight, notify]);

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
      notify("本章正文已生成", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "生成正文失败", "error");
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
          <h1>写作</h1>
          <p>请先在作品页选择一个作品，再开始写作。</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            前往作品页
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
        <h2>写作助手</h2>
        <p className="assistant-hint">选择一个章节后即可与 AI 协作。</p>
      </section>
    );

  return (
    <section className="workspace-page writing-page">
      <div className="page-header">
        <div>
          <h1>{outline?.title ?? "写作"}</h1>
          <p>选择章节进行正文创作，支持自动保存与 AI 协作。</p>
        </div>
        <Select
          aria-label="选择章节"
          className="chapter-picker"
          selectedKeys={selectedId != null ? [String(selectedId)] : []}
          isDisabled={chapters.length === 0}
          placeholder="选择章节"
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) setSelectedId(Number(key));
          }}
        >
          {chapters.map((chapter: Chapter) => (
            <SelectItem key={String(chapter.id)}>
              {`第 ${chapter.chapter_number} 章${chapter.title ? ` · ${chapter.title}` : ""}`}
            </SelectItem>
          ))}
        </Select>
      </div>

      {chapters.length === 0 ? (
        <div className="outline-empty">
          <p>该作品还没有章节。请先在大纲页生成章节后再来写作。</p>
          <Button color="primary" onPress={() => navigate("/outline")}>
            前往大纲页
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
