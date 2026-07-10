/** Assistant-panel editor for a selected chapter (``OUTLINE_PAGE_DESIGN.md`` §3.2). */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { updateChapter, type Chapter, type WorkStage } from "../../api";
import { AddEntityButton } from "../../components/AddEntityButton";
import { AddInspirationButton } from "../../components/AddInspirationButton";
import { LinkEntityButton } from "../../components/LinkEntityButton";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";
import {
  CHAPTER_STATUS_VALUES,
  chapterStatusLabelKey,
} from "../../utils/chapterStatus";
import { translatePresetStageName } from "../../utils/storyStructureI18n";

const UNASSIGNED_KEY = "none";

interface ChapterPanelProps {
  chapter: Chapter;
  stages: WorkStage[];
  structureName: string | null | undefined;
  onSaved: (chapter: Chapter) => void;
  onGenerate: (chapter: Chapter) => void;
  onCancel: () => void;
}

/** Edit a chapter's outline (title, summary, status, stage) and generate body. */
export function ChapterPanel(props: ChapterPanelProps): ReactElement {
  const { chapter } = props;
  const { t } = useTranslation(["outline", "works", "common"]);
  const { notify } = useToast();
  const [title, setTitle] = useState(chapter.title ?? "");
  const [summary, setSummary] = useState(chapter.summary ?? "");
  const [status, setStatus] = useState(chapter.status);
  const [stageId, setStageId] = useState<number | null>(chapter.stage_id);
  const [saving, setSaving] = useState(false);

  async function persist(): Promise<Chapter | null> {
    setSaving(true);
    try {
      const saved = await updateChapter(chapter.id, {
        title,
        summary,
        status,
        stage_id: stageId,
      });
      props.onSaved(saved);
      return saved;
    } catch {
      notify(t("outline:toast.saveChapterFailed"), "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (await persist()) {
      notify(t("outline:toast.chapterSaved"), "success");
    }
  }

  async function handleGenerate(): Promise<void> {
    const saved = await persist();
    if (saved) {
      props.onGenerate(saved);
    }
  }

  return (
    <section className="assistant-section work-form">
      <h2>{t("outline:chapterPanel.title", { number: chapter.chapter_number })}</h2>
      <Input
        label={t("outline:chapterPanel.titleLabel")}
        value={title}
        onValueChange={setTitle}
      />
      <Select
        label={t("outline:chapterPanel.stageLabel")}
        selectedKeys={[stageId == null ? UNASSIGNED_KEY : String(stageId)]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined;
          setStageId(key && key !== UNASSIGNED_KEY ? Number(key) : null);
        }}
      >
        {[
          <SelectItem key={UNASSIGNED_KEY}>{t("outline:chapters.unassigned")}</SelectItem>,
          ...props.stages.map((stage) => (
            <SelectItem key={String(stage.id)}>
              {translatePresetStageName(props.structureName, stage.name, t)}
            </SelectItem>
          )),
        ]}
      </Select>
      <Select
        label={t("outline:chapterPanel.statusLabel")}
        selectedKeys={[status]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined;
          if (key) setStatus(key);
        }}
      >
        {CHAPTER_STATUS_VALUES.map((value) => (
          <SelectItem key={value}>{t(chapterStatusLabelKey(value))}</SelectItem>
        ))}
      </Select>
      <MentionTextarea
        workId={chapter.work_id}
        label={t("outline:chapterPanel.summaryLabel")}
        minRows={6}
        value={summary}
        onValueChange={setSummary}
        placeholder={t("outline:chapterPanel.summaryPlaceholder")}
      />
      <div className="form-actions form-actions-stacked">
        <div className="form-actions-inline-tools">
          <AddInspirationButton
            source={{ source_page: "outline", work_id: chapter.work_id, chapter_id: chapter.id }}
            getFallbackText={() => summary}
          />
          <AddEntityButton workId={chapter.work_id} text={summary} onTextChange={setSummary} />
          <LinkEntityButton workId={chapter.work_id} text={summary} onTextChange={setSummary} />
        </div>
        <div className="form-actions-row">
          <Button size="sm" variant="light" onPress={props.onCancel}>
            {t("common:cancel")}
          </Button>
          <Button size="sm" variant="flat" isLoading={saving} onPress={() => void handleSave()}>
            {t("common:save")}
          </Button>
          <Button
            size="sm"
            color="primary"
            isLoading={saving}
            onPress={() => void handleGenerate()}
          >
            {t("outline:chapterPanel.writeBody")}
          </Button>
        </div>
      </div>
    </section>
  );
}
