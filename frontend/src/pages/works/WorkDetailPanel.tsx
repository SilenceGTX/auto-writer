/** Work detail / edit panel rendered in the assistant area (``STORY_PAGE_DESIGN.md`` §3). */
import { useState, type ReactElement } from "react";
import { Button, Input, Textarea } from "@heroui/react";
import { updateWork, type Series, type StoryStructure, type Work } from "../../api";
import { useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { computeProgress } from "../../utils/workProgress";
import { SeriesSelect } from "./SeriesSelect";
import { StructureSelect } from "./StructureSelect";

interface WorkDetailPanelProps {
  work: Work;
  seriesList: Series[];
  structures: StoryStructure[];
  onSeriesCreated: (series: Series) => void;
  onStructureCreated: (structure: StoryStructure) => void;
  onSaved: (work: Work) => void;
  onCancel: () => void;
}

/** Read-only stat row helper. */
function Stat(props: { label: string; value: string }): ReactElement {
  return (
    <div className="detail-stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

/** Render the editable detail view for a selected work. */
export function WorkDetailPanel(props: WorkDetailPanelProps): ReactElement {
  const { work } = props;
  const { notify } = useToast();
  const [title, setTitle] = useState(work.title);
  const [seriesId, setSeriesId] = useState<number | null>(work.series_id);
  const [structureId, setStructureId] = useState<number | null>(work.structure_id);
  const [plannedChapters, setPlannedChapters] = useState(
    work.planned_chapter_count == null ? "" : String(work.planned_chapter_count),
  );
  const [summary, setSummary] = useState(work.summary ?? "");
  const [saving, setSaving] = useState(false);
  const [askRegenerate, setAskRegenerate] = useState(false);

  const progress = computeProgress(work);
  const outlineLocked = work.actual_chapter_count != null;
  const avg =
    work.written_chapter_count > 0
      ? Math.round(work.total_word_count / work.written_chapter_count).toLocaleString()
      : "-";

  async function persist(): Promise<Work | null> {
    setSaving(true);
    try {
      const planned = plannedChapters.trim() ? Number(plannedChapters) : null;
      const saved = await updateWork(work.id, {
        title: title.trim() || work.title,
        series_id: seriesId,
        structure_id: structureId,
        planned_chapter_count: outlineLocked
          ? undefined
          : Number.isNaN(planned as number)
            ? null
            : planned,
        summary,
      });
      props.onSaved(saved);
      notify("作品已更新", "success");
      return saved;
    } catch {
      notify("更新作品失败", "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(): Promise<void> {
    const saved = await persist();
    if (saved && structureId !== work.structure_id) {
      setAskRegenerate(true);
    }
  }

  return (
    <section className="assistant-section work-form">
      <h2>作品详情</h2>
      <Input label="作品名称" value={title} onValueChange={setTitle} />
      <SeriesSelect
        seriesList={props.seriesList}
        value={seriesId}
        onChange={setSeriesId}
        onSeriesCreated={props.onSeriesCreated}
      />
      <StructureSelect
        structures={props.structures}
        value={structureId}
        onChange={setStructureId}
        onStructureCreated={props.onStructureCreated}
      />
      <Input
        label="总体章节数量"
        type="number"
        min={0}
        value={outlineLocked ? String(work.actual_chapter_count ?? "") : plannedChapters}
        onValueChange={setPlannedChapters}
        isDisabled={outlineLocked}
        description={outlineLocked ? "大纲已锁定，章节数由大纲决定" : undefined}
      />

      <div className="detail-stats">
        <Stat label="状态" value={work.status} />
        <Stat label="进度" value={progress.label} />
        <Stat label="字数" value={`${work.total_word_count.toLocaleString()} 字`} />
        <Stat label="章节平均字数" value={avg} />
        <Stat label="创建时间" value={work.created_at} />
        <Stat label="更新时间" value={work.updated_at} />
      </div>

      <Textarea label="作品简介" minRows={4} value={summary} onValueChange={setSummary} />
      <div className="form-actions">
        <Button variant="light" onPress={props.onCancel}>
          取消
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
          保存修改
        </Button>
      </div>

      <ConfirmDialog
        isOpen={askRegenerate}
        title="重新生成阶段树和总纲"
        body="故事结构已变更，是否重新生成阶段树和总纲？（将在大纲页执行生成）"
        confirmLabel="是"
        cancelLabel="否"
        onConfirm={() => {
          setAskRegenerate(false);
          notify("将在大纲页根据新结构重新生成", "info");
        }}
        onCancel={() => setAskRegenerate(false)}
      />
    </section>
  );
}
