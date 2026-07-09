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
  const { t } = useTranslation("works");
  const { notify } = useToast();
  const [overview, setOverview] = useState(stage.overview ?? "");
  const [saving, setSaving] = useState(false);

  const ratio =
    props.totalChapters > 0
      ? Math.round((stage.chapter_count / props.totalChapters) * 100)
      : 0;

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      props.onSaved(await updateStage(stage.id, { overview }));
      notify("阶段总纲已保存", "success");
    } catch {
      notify("保存阶段总纲失败", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="assistant-section work-form">
      <h2>阶段：{translatePresetStageName(props.structureName, stage.name, t)}</h2>
      <div className="detail-stats">
        <div className="detail-stat">
          <span>章节总数</span>
          <strong>{stage.chapter_count} 章</strong>
        </div>
        <div className="detail-stat">
          <span>章节占比</span>
          <strong>{ratio}%</strong>
        </div>
      </div>
      <MentionTextarea
        workId={stage.work_id}
        label="阶段总纲"
        minRows={8}
        value={overview}
        onValueChange={setOverview}
        placeholder="该阶段的关键剧情走向...（输入 @ 可引用设定条目）"
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
          <Button variant="light" onPress={props.onCancel}>
            取消
          </Button>
          <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
            保存
          </Button>
        </div>
      </div>
    </section>
  );
}
