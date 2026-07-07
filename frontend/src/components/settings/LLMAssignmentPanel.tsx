/** Panel for assigning each generation/chat task to an LLM profile. */
import type { ReactElement } from "react";
import { Select, SelectItem } from "@heroui/react";
import type { LLMAssignments, LLMProfile } from "../../api";
import { LLM_TASK_KEYS, LLM_TASK_LABELS, profileLabel } from "../../utils/llmSettings";

interface LLMAssignmentPanelProps {
  profiles: LLMProfile[];
  assignments: LLMAssignments;
  onChange: (next: LLMAssignments) => void;
}

/** Render one dropdown per LLM task mapped to the configured profiles. */
export function LLMAssignmentPanel(props: LLMAssignmentPanelProps): ReactElement {
  return (
    <section className="settings-section llm-assignment-panel">
      <p className="assistant-hint">
        每个环节必须指定一个模型。删除模型后，相关环节会自动改用最上方的第一个模型。
      </p>
      {LLM_TASK_KEYS.map((task) => {
        const fallbackId = props.profiles[0]?.id ?? "";
        const selectedId = props.profiles.some((profile) => profile.id === props.assignments[task])
          ? props.assignments[task]
          : fallbackId;
        return (
        <Select
          key={task}
          label={LLM_TASK_LABELS[task]}
          selectedKeys={selectedId ? [selectedId] : []}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string | undefined;
            if (value) {
              props.onChange({ ...props.assignments, [task]: value });
            }
          }}
        >
          {props.profiles.map((profile, index) => (
            <SelectItem key={profile.id}>{profileLabel(profile, index)}</SelectItem>
          ))}
        </Select>
        );
      })}
    </section>
  );
}
