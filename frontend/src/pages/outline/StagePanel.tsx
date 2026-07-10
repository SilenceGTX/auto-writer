/** Assistant-panel editor for a selected stage (``OUTLINE_PAGE_DESIGN.md`` §3.1). */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heroui/react";
import { updateStage, type WorkStage } from "../../api";
import { AddEntityButton } from "../../components/AddEntityButton";
import { AddInspirationButton } from "../../components/AddInspirationButton";
import { LinkEntityButton } from "../../components/LinkEntityButton";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";
import { translatePresetStageName } from "../../utils/storyStructureI18n";

interface StagePanelProps {
  stage: WorkStage;
  structureName: string | null | undefined;
  totalChapters: number;
  onSaved: (stage: WorkStage) => void;
  onCancel: () => void;
}

/** Edit a stage's synopsis (总纲) and show its chapter share. */
export function StagePanel(props: StagePanelProps): ReactElement {
  const { stage } = props;
  const { t } = useTranslation(["outline", "works", "common"]);
  const { notify } = useToast();
  const [overview, setOverview] = useState(stage.overview ?? "");
  const [saving, setSaving] = useState(false);

  const ratio =
    props.totalChapters > 0
      ? Math.round((stage.chapter_count / props.totalChapters) * 100)
      : 0;
  const stageName = translatePresetStageName(props.structureName, stage.name, t);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      props.onSaved(await updateStage(stage.id, { overview }));
      notify(t("outline:toast.stageSaved"), "success");
    } catch {
      notify(t("outline:toast.saveStageFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="assistant-section work-form">
      <h2>{t("outline:stagePanel.title", { name: stageName })}</h2>
      <div className="detail-stats">
        <div className="detail-stat">
          <span>{t("outline:stagePanel.chapterTotal")}</span>
          <strong>
            {t("outline:stagePanel.chapterTotalValue", { count: stage.chapter_count })}
          </strong>
        </div>
        <div className="detail-stat">
          <span>{t("outline:stagePanel.chapterRatio")}</span>
          <strong>{ratio}%</strong>
        </div>
      </div>
      <MentionTextarea
        workId={stage.work_id}
        label={t("outline:stagePanel.overviewLabel")}
        minRows={8}
        value={overview}
        onValueChange={setOverview}
        placeholder={t("outline:stagePanel.overviewPlaceholder")}
      />
      <div className="form-actions form-actions-stacked">
        <div className="form-actions-inline-tools">
          <AddInspirationButton
            source={{ source_page: "outline", work_id: stage.work_id }}
            getFallbackText={() => overview}
          />
          <AddEntityButton workId={stage.work_id} text={overview} onTextChange={setOverview} />
          <LinkEntityButton workId={stage.work_id} text={overview} onTextChange={setOverview} />
        </div>
        <div className="form-actions-row">
          <Button size="sm" variant="light" onPress={props.onCancel}>
            {t("common:cancel")}
          </Button>
          <Button size="sm" color="primary" isLoading={saving} onPress={() => void handleSave()}>
            {t("common:save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
