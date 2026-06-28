/** Assistant-panel editor for a selected chapter (``OUTLINE_PAGE_DESIGN.md`` §3.2). */
import { useState, type ReactElement } from "react";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { updateChapter, type Chapter, type WorkStage } from "../../api";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";

const CHAPTER_STATUSES = ["草稿", "已完成"];
const UNASSIGNED_KEY = "none";

interface ChapterPanelProps {
  chapter: Chapter;
  stages: WorkStage[];
  onSaved: (chapter: Chapter) => void;
  onGenerate: (chapter: Chapter) => void;
  onCancel: () => void;
}

/** Edit a chapter's outline (title, summary, status, stage) and generate body. */
export function ChapterPanel(props: ChapterPanelProps): ReactElement {
  const { chapter } = props;
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
      notify("保存章节失败", "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (await persist()) {
      notify("章节已保存", "success");
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
      <h2>第 {chapter.chapter_number} 章</h2>
      <Input label="章节标题" value={title} onValueChange={setTitle} />
      <Select
        label="所属阶段"
        selectedKeys={[stageId == null ? UNASSIGNED_KEY : String(stageId)]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined;
          setStageId(key && key !== UNASSIGNED_KEY ? Number(key) : null);
        }}
      >
        {[
          <SelectItem key={UNASSIGNED_KEY}>未分配</SelectItem>,
          ...props.stages.map((stage) => (
            <SelectItem key={String(stage.id)}>{stage.name}</SelectItem>
          )),
        ]}
      </Select>
      <Select
        label="状态"
        selectedKeys={[status]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string | undefined;
          if (key) setStatus(key);
        }}
      >
        {CHAPTER_STATUSES.map((value) => (
          <SelectItem key={value}>{value}</SelectItem>
        ))}
      </Select>
      <MentionTextarea
        workId={chapter.work_id}
        label="章节概述"
        minRows={6}
        value={summary}
        onValueChange={setSummary}
        placeholder="本章大致写什么...（输入 @ 可引用设定条目）"
      />
      <div className="form-actions">
        <Button variant="light" onPress={props.onCancel}>
          取消
        </Button>
        <Button variant="flat" isLoading={saving} onPress={() => void handleSave()}>
          保存
        </Button>
        <Button color="primary" isLoading={saving} onPress={() => void handleGenerate()}>
          保存并生成正文
        </Button>
      </div>
    </section>
  );
}
