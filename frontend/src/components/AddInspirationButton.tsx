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
import { Lightbulb } from "lucide-react";
import { createInspiration, type InspirationSource } from "../api";
import { useToast } from "./Toast";
import { getActiveSelectionText } from "../utils/selection";

interface AddInspirationButtonProps {
  source: InspirationSource;
  getFallbackText?: () => string;
  label?: string;
}

/** Render a small button that saves the current selection as an inspiration. */
export function AddInspirationButton(props: AddInspirationButtonProps): ReactElement {
  const { notify } = useToast();
  const captured = useRef("");

  async function save(): Promise<void> {
    const text = (captured.current || props.getFallbackText?.() || "").trim();
    captured.current = "";
    if (!text) {
      notify("请先选择要加入灵感的文字", "info");
      return;
    }
    try {
      await createInspiration({ content: text, ...props.source });
      notify("已加入灵感", "success");
    } catch {
      notify("加入灵感失败", "error");
    }
  }

  return (
    <button
      type="button"
      className="add-inspiration-btn"
      title="将选中的文字加入灵感"
      onMouseDown={(event) => {
        event.preventDefault();
        captured.current = getActiveSelectionText();
      }}
      onClick={() => void save()}
    >
      <Lightbulb size={15} />
      <span>{props.label ?? "加入灵感"}</span>
    </button>
  );
}
