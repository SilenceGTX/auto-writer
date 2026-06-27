/** "New work" form rendered in the assistant panel (``STORY_PAGE_DESIGN.md`` §2.4). */
import { useState, type ReactElement } from "react";
import { Button, Input, Textarea } from "@heroui/react";
import {
  createWork,
  type Series,
  type StoryStructure,
  type Work,
} from "../../api";
import { useToast } from "../../components/Toast";
import { SeriesSelect } from "./SeriesSelect";
import { StructureSelect } from "./StructureSelect";

interface WorkCreateFormProps {
  seriesList: Series[];
  structures: StoryStructure[];
  onSeriesCreated: (series: Series) => void;
  onStructureCreated: (structure: StoryStructure) => void;
  onCreated: (work: Work) => void;
  onCancel: () => void;
}

/** Render the contextual new-work form with structure/series pickers. */
export function WorkCreateForm(props: WorkCreateFormProps): ReactElement {
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [structureId, setStructureId] = useState<number | null>(null);
  const [plannedChapters, setPlannedChapters] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!title.trim()) {
      notify("请填写作品名称", "error");
      return;
    }
    setSaving(true);
    try {
      const planned = plannedChapters.trim() ? Number(plannedChapters) : null;
      const created = await createWork({
        title: title.trim(),
        series_id: seriesId,
        structure_id: structureId,
        planned_chapter_count: Number.isNaN(planned as number) ? null : planned,
        summary,
      });
      props.onCreated(created);
    } catch {
      notify("创建作品失败", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="assistant-section work-form">
      <h2>新建作品</h2>
      <Input label="作品名称" value={title} onValueChange={setTitle} autoFocus isRequired />
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
        label="大致章节数量"
        type="number"
        min={0}
        value={plannedChapters}
        onValueChange={setPlannedChapters}
      />
      <Textarea label="作品简介" minRows={4} value={summary} onValueChange={setSummary} />
      <div className="form-actions">
        <Button variant="light" onPress={props.onCancel}>
          取消
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
          创建作品
        </Button>
      </div>
    </section>
  );
}
