/** Reusable autosave status indicator (rule G6). */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Check, Loader2 } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveStatusProps {
  state: SaveState;
}

/** Render an icon + label reflecting the current autosave state. */
export function SaveStatus(props: SaveStatusProps): ReactElement {
  const { t } = useTranslation("common");

  return (
    <span className={`save-status save-status-${props.state}`} aria-live="polite">
      {props.state === "saving" && <Loader2 size={14} className="save-status-spin" />}
      {props.state === "saved" && <Check size={14} />}
      {props.state === "error" && <AlertCircle size={14} />}
      <span>{t(`saveStatus.${props.state}`)}</span>
    </span>
  );
}
