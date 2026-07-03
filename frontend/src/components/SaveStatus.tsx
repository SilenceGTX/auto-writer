/** Reusable autosave status indicator (rule G6). */
import type { ReactElement } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveStatusProps {
  state: SaveState;
}

const LABELS: Record<SaveState, string> = {
  idle: "未更改",
  saving: "保存中…",
  saved: "已保存",
  error: "保存失败",
};

/** Render an icon + label reflecting the current autosave state. */
export function SaveStatus(props: SaveStatusProps): ReactElement {
  return (
    <span className={`save-status save-status-${props.state}`} aria-live="polite">
      {props.state === "saving" && <Loader2 size={14} className="save-status-spin" />}
      {props.state === "saved" && <Check size={14} />}
      {props.state === "error" && <AlertCircle size={14} />}
      <span>{LABELS[props.state]}</span>
    </span>
  );
}
