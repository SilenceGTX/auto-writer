/** Reusable "@" action for outline editors: link selection to an existing entry.
 *
 * Captures the textarea selection on ``mousedown``, looks up an entry by exact
 * name match, and replaces the selection with an ``@名称 `` marker (trailing
 * space matches ``useEntityMentions`` / ``AddEntityButton``).
 */
import { useRef, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "./Toast";
import { findEntitiesByExactName } from "../utils/entityLookup";
import { replaceRangeWithMention } from "../utils/mentionText";
import { getActiveSelectionRange, type TextSelectionRange } from "../utils/selection";

interface LinkEntityButtonProps {
  workId: number;
  text: string;
  onTextChange: (value: string) => void;
}

/** Render a compact ``@`` button that links the selection to an existing entry. */
export function LinkEntityButton(props: LinkEntityButtonProps): ReactElement {
  const { t } = useTranslation("outline");
  const { notify } = useToast();
  const capturedRange = useRef<TextSelectionRange | null>(null);
  const label = t("selectionActions.linkEntity.label");

  async function link(): Promise<void> {
    const range = capturedRange.current;
    capturedRange.current = null;
    if (!range?.text.trim()) {
      notify(t("selectionActions.linkEntity.emptySelection"), "info");
      return;
    }
    const name = range.text.trim();
    if (name.startsWith("@")) {
      notify(t("selectionActions.linkEntity.alreadyLinked"), "info");
      return;
    }
    try {
      const matches = await findEntitiesByExactName(props.workId, name);
      if (matches.length === 0) {
        notify(t("selectionActions.linkEntity.notFound", { name }), "info");
        return;
      }
      if (matches.length > 1) {
        notify(t("selectionActions.linkEntity.duplicateName", { name }), "info");
        return;
      }
      props.onTextChange(
        replaceRangeWithMention(props.text, range.start, range.end, matches[0].name),
      );
      notify(t("selectionActions.linkEntity.linked"), "success");
    } catch {
      notify(t("selectionActions.linkEntity.lookupFailed"), "error");
    }
  }

  return (
    <button
      type="button"
      className="selection-action-btn selection-action-link"
      title={label}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
        capturedRange.current = getActiveSelectionRange();
      }}
      onClick={() => void link()}
    >
      @
    </button>
  );
}
