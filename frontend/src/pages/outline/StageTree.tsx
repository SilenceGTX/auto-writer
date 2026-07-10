/** Stage tree: proportional colored blocks with chapter-count controls (§2.1). */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@heroui/react";
import type { WorkStage } from "../../api";
import { stageColor, stageHeightPercent } from "../../utils/outline";
import { translatePresetStageName } from "../../utils/storyStructureI18n";

interface StageTreeProps {
  stages: WorkStage[];
  structureName: string | null | undefined;
  totalChapters: number;
  selectedStageId: number | null;
  locked: boolean;
  onSelect: (stageId: number) => void;
  onCountChange: (stageId: number, count: number) => void;
}

/** A single stage block whose height reflects its share of chapters. */
function StageBlock(props: {
  stage: WorkStage;
  displayName: string;
  color: string;
  height: number;
  ratio: number;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onCountChange: (count: number) => void;
}): ReactElement {
  const { t } = useTranslation("outline");
  const { stage } = props;
  const [draft, setDraft] = useState(String(stage.chapter_count));

  return (
    <button
      type="button"
      className={`stage-block ${props.selected ? "selected" : ""}`}
      style={{ borderColor: props.color, minHeight: `${props.height}px` }}
      onClick={props.onSelect}
    >
      <span className="stage-bar" style={{ background: props.color }} />
      <span className="stage-block-body">
        <strong>{props.displayName}</strong>
        <span className="stage-count">
          {t("stageTree.ratio", { ratio: props.ratio })}
        </span>
        <span className="stage-count-field" onClick={(event) => event.stopPropagation()}>
          <Input
            aria-label={t("stageTree.chapterCountAria", { name: props.displayName })}
            size="sm"
            type="number"
            min={0}
            value={draft}
            isDisabled={props.locked}
            classNames={{
              base: "stage-count-input",
              inputWrapper: "stage-count-input-wrapper",
              input: "stage-count-input-inner",
            }}
            onValueChange={setDraft}
            onBlur={() => {
              const next = Number(draft);
              if (!Number.isNaN(next) && next !== stage.chapter_count) {
                props.onCountChange(next);
              } else {
                setDraft(String(stage.chapter_count));
              }
            }}
          />
          <span className="stage-count-unit">{t("stageTree.chapterUnit")}</span>
        </span>
      </span>
    </button>
  );
}

/** Render the vertical stage tree for the outline workspace. */
export function StageTree(props: StageTreeProps): ReactElement {
  const { t } = useTranslation(["outline", "works"]);
  const maxCount = Math.max(1, ...props.stages.map((stage) => stage.chapter_count));

  return (
    <div className="stage-tree">
      <h2>{t("outline:stageTree.title")}</h2>
      {props.stages.map((stage, index) => (
        <StageBlock
          key={stage.id}
          stage={stage}
          displayName={translatePresetStageName(props.structureName, stage.name, t)}
          color={stageColor(index)}
          height={40 + stageHeightPercent(stage.chapter_count, maxCount)}
          ratio={
            props.totalChapters > 0
              ? Math.round((stage.chapter_count / props.totalChapters) * 100)
              : 0
          }
          selected={props.selectedStageId === stage.id}
          locked={props.locked}
          onSelect={() => props.onSelect(stage.id)}
          onCountChange={(count) => props.onCountChange(stage.id, count)}
        />
      ))}
    </div>
  );
}
