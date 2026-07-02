/** Assistant-panel editor for a selected stage (``OUTLINE_PAGE_DESIGN.md`` §3.1). */
import { useState, type ReactElement } from "react";
import { Button } from "@heroui/react";
import { updateStage, type WorkStage } from "../../api";
import { AddInspirationButton } from "../../components/AddInspirationButton";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";

interface StagePanelProps {
  stage: WorkStage;
  totalChapters: number;
  onSaved: (stage: WorkStage) => void;
  onCancel: () => void;
}

/** Edit a stage's synopsis (总纲) and show its chapter share. */
export function StagePanel(props: StagePanelProps): ReactElement {
  const { stage } = props;
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
      <h2>阶段：{stage.name}</h2>
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
      <div className="form-actions">
        <AddInspirationButton
          source={{ source_page: "outline", work_id: stage.work_id }}
          getFallbackText={() => overview}
        />
        <Button variant="light" onPress={props.onCancel}>
          取消
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
          保存
        </Button>
      </div>
    </section>
  );
}
