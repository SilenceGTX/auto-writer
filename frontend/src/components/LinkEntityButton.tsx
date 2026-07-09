/** Reusable "@" action for outline editors: link selection to an existing entry.
 *
 * Captures the textarea selection on ``mousedown``, looks up an entry by exact
 * name match, and replaces the selection with an ``@名称 `` marker (trailing
 * space matches ``useEntityMentions`` / ``AddEntityButton``).
 */
import { useRef, type ReactElement } from "react";
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
  const { notify } = useToast();
  const capturedRange = useRef<TextSelectionRange | null>(null);

  async function link(): Promise<void> {
    const range = capturedRange.current;
    capturedRange.current = null;
    if (!range?.text.trim()) {
      notify("请先选择要引用的文字", "info");
      return;
    }
    const name = range.text.trim();
    if (name.startsWith("@")) {
      notify("选中内容已是设定引用", "info");
      return;
    }
    try {
      const matches = await findEntitiesByExactName(props.workId, name);
      if (matches.length === 0) {
        notify(`未找到名为「${name}」的设定条目，可使用「加入设定」新建`, "info");
        return;
      }
      if (matches.length > 1) {
        notify(`存在多个名为「${name}」的设定条目，请先在设定页区分`, "info");
        return;
      }
      props.onTextChange(
        replaceRangeWithMention(props.text, range.start, range.end, matches[0].name),
      );
      notify("已添加设定引用", "success");
    } catch {
      notify("查找设定条目失败", "error");
    }
  }

  return (
    <button
      type="button"
      className="link-entity-btn"
      title="将选中文字替换为已有设定的 @ 引用"
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
