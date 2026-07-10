/** Outline page: stage tree, chapter outline, and AI generation.
 *
 * Implements ``designs/OUTLINE_PAGE_DESIGN.md``: generate the stage tree and
 * synopses, generate chapter outlines, adjust per-stage chapter counts, edit
 * stages/chapters in the assistant panel, reorder chapters, and hand off to the
 * writing page via "撰写正文".
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button, Chip } from "@heroui/react";
import { Sparkles, Wand2 } from "lucide-react";
import {
  addChapter,
  deleteChapter,
  generateChapterOutlines,
  generateStages,
  getOutline,
  reorderChapters,
  setStageChapterCount,
  type Chapter,
  type ChapterOrderItem,
  type Outline,
} from "../api";
import { useApp } from "../context/AppContext";
import { useAssistant } from "../context/AssistantContext";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { WorkTitleSelect } from "../components/WorkTitleSelect";
import { stageColorMap } from "../utils/outline";
import { translateOutlineApiError } from "../utils/outlineApiError";
import { translatePresetStructureName } from "../utils/storyStructureI18n";
import { ChapterOutline } from "./outline/ChapterOutline";
import { ChapterPanel } from "./outline/ChapterPanel";
import { StagePanel } from "./outline/StagePanel";
import { StageTree } from "./outline/StageTree";

type Selection = { type: "stage"; id: number } | { type: "chapter"; id: number } | null;

/** Render the outline workspace for the current work. */
export function OutlinePage(): ReactElement {
  const { t } = useTranslation(["outline", "works", "common", "errors"]);
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId } = useApp();
  const { slot, setPageOwnsPanel, setCollapsed } = useAssistant();

  const [outline, setOutline] = useState<Outline | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [generating, setGenerating] = useState<"stages" | "chapters" | null>(null);
  const [askRegenerate, setAskRegenerate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Chapter | null>(null);

  useEffect(() => {
    setPageOwnsPanel(true);
    return () => setPageOwnsPanel(false);
  }, [setPageOwnsPanel]);

  const loadOutline = useCallback(async () => {
    if (currentWorkId == null) {
      return;
    }
    try {
      setOutline(await getOutline(currentWorkId));
    } catch {
      notify(t("outline:toast.loadFailed"), "error");
    }
  }, [currentWorkId, notify, t]);

  useEffect(() => {
    void loadOutline();
  }, [loadOutline]);

  useEffect(() => {
    setSelection(null);
  }, [currentWorkId]);

  const colorMap = useMemo(() => stageColorMap(outline?.stages ?? []), [outline?.stages]);

  function select(next: Selection): void {
    setSelection(next);
    setCollapsed(false);
  }

  async function runGenerateStages(): Promise<void> {
    if (currentWorkId == null) return;
    setGenerating("stages");
    setSelection(null);
    try {
      setOutline(await generateStages(currentWorkId));
      notify(t("outline:toast.stagesGenerated"), "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(
        translateOutlineApiError(message, t, "outline:toast.generateStagesFailed"),
        "error",
      );
    } finally {
      setGenerating(null);
    }
  }

  async function runGenerateChapters(): Promise<void> {
    if (currentWorkId == null) return;
    setGenerating("chapters");
    try {
      setOutline(await generateChapterOutlines(currentWorkId));
      notify(t("outline:toast.chaptersGenerated"), "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(
        translateOutlineApiError(message, t, "outline:toast.generateChaptersFailed"),
        "error",
      );
    } finally {
      setGenerating(null);
    }
  }

  async function handleStageCount(stageId: number, count: number): Promise<void> {
    if (currentWorkId == null) return;
    try {
      setOutline(await setStageChapterCount(stageId, count));
    } catch {
      notify(t("outline:toast.adjustCountFailed"), "error");
    }
  }

  async function handleReorder(items: ChapterOrderItem[]): Promise<void> {
    if (currentWorkId == null) return;
    try {
      setOutline(await reorderChapters(currentWorkId, items));
    } catch {
      notify(t("outline:toast.reorderFailed"), "error");
    }
  }

  async function handleAddChapter(): Promise<void> {
    if (currentWorkId == null) return;
    try {
      const created = await addChapter(currentWorkId);
      await loadOutline();
      select({ type: "chapter", id: created.id });
    } catch {
      notify(t("outline:toast.addChapterFailed"), "error");
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    try {
      await deleteChapter(pendingDelete.id);
      if (selection?.type === "chapter" && selection.id === pendingDelete.id) {
        setSelection(null);
      }
      await loadOutline();
      notify(t("outline:toast.chapterDeleted"), "success");
    } catch {
      notify(t("outline:toast.deleteChapterFailed"), "error");
    } finally {
      setPendingDelete(null);
    }
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>{t("outline:page.title")}</h1>
          <p>{t("outline:page.emptyWork.body")}</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            {t("outline:page.emptyWork.goToWorks")}
          </Button>
        </div>
      </section>
    );
  }

  const selectedStage =
    selection?.type === "stage" ? outline?.stages.find((s) => s.id === selection.id) : undefined;
  const selectedChapter =
    selection?.type === "chapter"
      ? outline?.chapters.find((c) => c.id === selection.id)
      : undefined;

  const assistantContent = selectedStage ? (
    <StagePanel
      key={`stage-${selectedStage.id}`}
      stage={selectedStage}
      structureName={outline?.structure_name}
      totalChapters={outline?.chapters.length ?? 0}
      onSaved={() => void loadOutline()}
      onCancel={() => setSelection(null)}
    />
  ) : selectedChapter ? (
    <ChapterPanel
      key={`chapter-${selectedChapter.id}`}
      chapter={selectedChapter}
      stages={outline?.stages ?? []}
      structureName={outline?.structure_name}
      onSaved={() => void loadOutline()}
      onGenerate={(chapter) => navigate(`/writing?chapter=${chapter.id}`)}
      onCancel={() => setSelection(null)}
    />
  ) : (
    <section className="assistant-section">
      <h2>{t("outline:assistant.title")}</h2>
      <p className="assistant-hint">{t("outline:assistant.hint")}</p>
    </section>
  );

  const hasStages = (outline?.stages.length ?? 0) > 0;
  const chapterCount = outline?.chapters.length ?? 0;
  const plannedSummary =
    outline?.planned_chapter_count != null
      ? t("outline:page.plannedWithTarget", {
          count: chapterCount,
          planned: outline.planned_chapter_count,
        })
      : t("outline:page.planned", { count: chapterCount });

  return (
    <section className="workspace-page outline-page">
      <div className="page-header">
        <div>
          <WorkTitleSelect fallback={outline?.title ?? t("outline:page.fallbackTitle")} />
          <p>
            {outline?.structure_name
              ? `${t("works:structures.outlinePrefix")}${translatePresetStructureName(outline.structure_name, t)} · `
              : ""}
            {plannedSummary}
          </p>
        </div>
        <div className="outline-actions">
          {outline?.locked && (
            <Chip color="warning" variant="flat">
              {t("outline:page.locked")}
            </Chip>
          )}
          <Button
            variant="flat"
            startContent={<Sparkles size={16} />}
            isLoading={generating === "stages"}
            onPress={() => (hasStages ? setAskRegenerate(true) : void runGenerateStages())}
          >
            {hasStages ? t("outline:page.regenerateStages") : t("outline:page.generateStages")}
          </Button>
          <Button
            color="primary"
            startContent={<Wand2 size={16} />}
            isDisabled={!hasStages || chapterCount === 0}
            isLoading={generating === "chapters"}
            onPress={() => void runGenerateChapters()}
          >
            {t("outline:page.generateChapters")}
          </Button>
        </div>
      </div>

      {!hasStages ? (
        <div className="outline-empty">
          <p>{t("outline:page.emptyStages")}</p>
        </div>
      ) : (
        <div className="outline-grid">
          <StageTree
            stages={outline?.stages ?? []}
            structureName={outline?.structure_name}
            totalChapters={chapterCount}
            selectedStageId={selection?.type === "stage" ? selection.id : null}
            locked={outline?.locked ?? false}
            onSelect={(id) => select({ type: "stage", id })}
            onCountChange={(id, count) => void handleStageCount(id, count)}
          />
          <ChapterOutline
            chapters={outline?.chapters ?? []}
            stages={outline?.stages ?? []}
            structureName={outline?.structure_name}
            colorMap={colorMap}
            selectedChapterId={selection?.type === "chapter" ? selection.id : null}
            onSelectChapter={(id) => select({ type: "chapter", id })}
            onReorder={(items) => void handleReorder(items)}
            onAddChapter={() => void handleAddChapter()}
            onDeleteChapter={(chapter) => setPendingDelete(chapter)}
          />
        </div>
      )}

      {slot && createPortal(assistantContent, slot)}

      <ConfirmDialog
        isOpen={askRegenerate}
        title={t("outline:regenerateDialog.title")}
        body={t("outline:regenerateDialog.body")}
        confirmLabel={t("outline:regenerateDialog.confirm")}
        danger
        onConfirm={() => {
          setAskRegenerate(false);
          void runGenerateStages();
        }}
        onCancel={() => setAskRegenerate(false)}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t("outline:deleteDialog.title")}
        body={t("outline:deleteDialog.body", {
          number: pendingDelete?.chapter_number ?? "",
        })}
        confirmLabel={t("outline:deleteDialog.confirm")}
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
