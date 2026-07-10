/** Reusable "加入灵感" action button (``GENERAL_UI_DESIGN.md`` G3).
 *
 * Captures the user's current text selection (in a textarea/input or rendered
 * page content) the moment the button is pressed, then saves it as an
 * inspiration with the page's source references. Falling back to a provided
 * text lets pages save the field currently being edited when nothing is
 * selected. The selection is read on ``mousedown`` (with ``preventDefault``) so
 * focus does not move away from the source field before it is captured.
 */
import { useRef, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import { createInspiration, type InspirationSource } from "../api";
import { SelectionActionPlus } from "./SelectionActionPlus";
import { useToast } from "./Toast";
import { getActiveSelectionText } from "../utils/selection";

interface AddInspirationButtonProps {
  source: InspirationSource;
  getFallbackText?: () => string;
  /** Tooltip / aria label key; defaults to selection, use ``saveFallback`` when saving fallback text. */
  labelKey?: "selectionActions.addInspiration.label" | "selectionActions.addInspiration.saveFallback";
}

/** Render a compact button that saves the current selection as an inspiration. */
export function AddInspirationButton(props: AddInspirationButtonProps): ReactElement {
  const { t } = useTranslation("outline");
  const { notify } = useToast();
  const captured = useRef("");
  const label = t(props.labelKey ?? "selectionActions.addInspiration.label");

  async function save(): Promise<void> {
    const text = (captured.current || props.getFallbackText?.() || "").trim();
    captured.current = "";
    if (!text) {
      notify(t("selectionActions.addInspiration.emptySelection"), "info");
      return;
    }
    try {
      await createInspiration({ content: text, ...props.source });
      notify(t("selectionActions.addInspiration.saved"), "success");
    } catch {
      notify(t("selectionActions.addInspiration.saveFailed"), "error");
    }
  }

  return (
    <button
      type="button"
      className="selection-action-btn selection-action-inspiration"
      title={label}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
        captured.current = getActiveSelectionText();
      }}
      onClick={() => void save()}
    >
      <SelectionActionPlus />
      <Lightbulb aria-hidden />
    </button>
  );
}
