/** Outline page: stage tree, chapter outline, and AI generation.
 *
 * Implements ``designs/OUTLINE_PAGE_DESIGN.md``: generate the stage tree and
 * synopses, generate chapter outlines, adjust per-stage chapter counts, edit
 * stages/chapters in the assistant panel, reorder chapters, and hand off to the
 * writing page via "保存并生成正文".
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
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
import { stageColorMap } from "../utils/outline";
import { ChapterOutline } from "./outline/ChapterOutline";
import { ChapterPanel } from "./outline/ChapterPanel";
import { StagePanel } from "./outline/StagePanel";
import { StageTree } from "./outline/StageTree";

type Selection = { type: "stage"; id: number } | { type: "chapter"; id: number } | null;

/** Render the outline workspace for the current work. */
export function OutlinePage(): ReactElement {
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
      notify("无法加载大纲", "error");
    }
  }, [currentWorkId, notify]);

  useEffect(() => {
    void loadOutline();
  }, [loadOutline]);

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
      notify("阶段树与总纲已生成", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "生成阶段树失败", "error");
    } finally {
      setGenerating(null);
    }
  }

  async function runGenerateChapters(): Promise<void> {
    if (currentWorkId == null) return;
    setGenerating("chapters");
    try {
      setOutline(await generateChapterOutlines(currentWorkId));
      notify("章节大纲已生成", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "生成章节大纲失败", "error");
    } finally {
      setGenerating(null);
    }
  }

  async function handleStageCount(stageId: number, count: number): Promise<void> {
    if (currentWorkId == null) return;
    try {
      setOutline(await setStageChapterCount(stageId, count));
    } catch {
      notify("调整章节数失败", "error");
    }
  }

  async function handleReorder(items: ChapterOrderItem[]): Promise<void> {
    if (currentWorkId == null) return;
    try {
      setOutline(await reorderChapters(currentWorkId, items));
    } catch {
      notify("章节排序失败", "error");
    }
  }

  async function handleAddChapter(): Promise<void> {
    if (currentWorkId == null) return;
    try {
      const created = await addChapter(currentWorkId);
      await loadOutline();
      select({ type: "chapter", id: created.id });
    } catch {
      notify("添加章节失败", "error");
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
      notify("章节已删除", "success");
    } catch {
      notify("删除章节失败", "error");
    } finally {
      setPendingDelete(null);
    }
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>大纲</h1>
          <p>请先在作品页选择一个作品，再来编排大纲。</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            前往作品页
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
      totalChapters={outline?.chapters.length ?? 0}
      onSaved={() => void loadOutline()}
      onCancel={() => setSelection(null)}
    />
  ) : selectedChapter ? (
    <ChapterPanel
      key={`chapter-${selectedChapter.id}`}
      chapter={selectedChapter}
      stages={outline?.stages ?? []}
      onSaved={() => void loadOutline()}
      onGenerate={() => {
        notify("正文生成将在写作页进行", "info");
        navigate("/writing");
      }}
      onCancel={() => setSelection(null)}
    />
  ) : (
    <section className="assistant-section">
      <h2>大纲助手</h2>
      <p className="assistant-hint">在左侧选择一个阶段或章节即可在此编辑。</p>
    </section>
  );

  const hasStages = (outline?.stages.length ?? 0) > 0;

  return (
    <section className="workspace-page outline-page">
      <div className="page-header">
        <div>
          <h1>{outline?.title ?? "大纲"}</h1>
          <p>
            {outline?.structure_name ? `结构：${outline.structure_name} · ` : ""}
            已规划 {outline?.chapters.length ?? 0} 章
            {outline?.planned_chapter_count != null
              ? ` / 计划 ${outline.planned_chapter_count} 章`
              : ""}
          </p>
        </div>
        <div className="outline-actions">
          {outline?.locked && (
            <Chip color="warning" variant="flat">
              大纲已锁定
            </Chip>
          )}
          <Button
            variant="flat"
            startContent={<Sparkles size={16} />}
            isLoading={generating === "stages"}
            onPress={() => (hasStages ? setAskRegenerate(true) : void runGenerateStages())}
          >
            {hasStages ? "重新生成阶段树" : "生成阶段树"}
          </Button>
          <Button
            color="primary"
            startContent={<Wand2 size={16} />}
            isDisabled={!hasStages || (outline?.chapters.length ?? 0) === 0}
            isLoading={generating === "chapters"}
            onPress={() => void runGenerateChapters()}
          >
            生成章节大纲
          </Button>
        </div>
      </div>

      {!hasStages ? (
        <div className="outline-empty">
          <p>
            还没有阶段树。请确认已在作品页选择含阶段的故事结构，并在系统设置中配置好 LLM
            连接，然后点击「生成阶段树」。
          </p>
        </div>
      ) : (
        <div className="outline-grid">
          <StageTree
            stages={outline?.stages ?? []}
            totalChapters={outline?.chapters.length ?? 0}
            selectedStageId={selection?.type === "stage" ? selection.id : null}
            locked={outline?.locked ?? false}
            onSelect={(id) => select({ type: "stage", id })}
            onCountChange={(id, count) => void handleStageCount(id, count)}
          />
          <ChapterOutline
            chapters={outline?.chapters ?? []}
            stages={outline?.stages ?? []}
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
        title="重新生成阶段树"
        body="重新生成将替换现有阶段树、总纲与章节大纲，且无法恢复。确定继续吗？"
        confirmLabel="重新生成"
        danger
        onConfirm={() => {
          setAskRegenerate(false);
          void runGenerateStages();
        }}
        onCancel={() => setAskRegenerate(false)}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="删除章节"
        body={`确定要删除第 ${pendingDelete?.chapter_number ?? ""} 章吗？此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
