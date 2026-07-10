/** Work detail / edit panel rendered in the assistant area (``STORY_PAGE_DESIGN.md`` §3). */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Textarea } from "@heroui/react";
import { updateWork, type Series, type StoryStructure, type Work } from "../../api";
import { useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { computeProgress } from "../../utils/workProgress";
import { workStatusLabelKey } from "../../utils/workStatus";
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
  const { t } = useTranslation(["works", "common"]);
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
  const progressLabel = progress.isPrep ? t("works:progress.prep") : progress.label;

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
      notify(t("works:toast.updated"), "success");
      return saved;
    } catch {
      notify(t("works:toast.updateFailed"), "error");
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
      <h2>{t("works:detail.title")}</h2>
      <Input label={t("works:createForm.titleLabel")} value={title} onValueChange={setTitle} />
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
        label={t("works:detail.totalChapters")}
        type="number"
        min={0}
        value={outlineLocked ? String(work.actual_chapter_count ?? "") : plannedChapters}
        onValueChange={setPlannedChapters}
        isDisabled={outlineLocked}
        description={outlineLocked ? t("works:detail.chaptersLockedHint") : undefined}
      />

      <div className="detail-stats">
        <Stat label={t("works:detail.stats.status")} value={t(workStatusLabelKey(work.status))} />
        <Stat label={t("works:detail.stats.progress")} value={progressLabel} />
        <Stat
          label={t("works:detail.stats.wordCount")}
          value={t("works:detail.stats.wordCountUnit", { count: work.total_word_count.toLocaleString() })}
        />
        <Stat label={t("works:detail.stats.avgWordsPerChapter")} value={avg} />
        <Stat label={t("works:detail.stats.createdAt")} value={work.created_at} />
        <Stat label={t("works:detail.stats.updatedAt")} value={work.updated_at} />
      </div>

      <Textarea
        label={t("works:createForm.summary")}
        minRows={4}
        value={summary}
        onValueChange={setSummary}
      />
      <div className="form-actions">
        <Button variant="light" onPress={props.onCancel}>
          {t("common:cancel")}
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
          {t("works:detail.save")}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={askRegenerate}
        title={t("works:detail.regenerateDialog.title")}
        body={t("works:detail.regenerateDialog.body")}
        confirmLabel={t("works:detail.regenerateDialog.confirm")}
        cancelLabel={t("works:detail.regenerateDialog.cancel")}
        onConfirm={() => {
          setAskRegenerate(false);
          notify(t("works:toast.regenerateHint"), "info");
        }}
        onCancel={() => setAskRegenerate(false)}
      />
    </section>
  );
}
