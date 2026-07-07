/** Reusable "加入设定" action for outline editors.
 *
 * Captures the user's textarea selection, opens the create-entry modal with the
 * snippet as the default name, and on save replaces the selection with an
 * ``@名称`` reference marker in the parent field.
 */
import { useRef, useState, type ReactElement } from "react";
import { Sparkles } from "lucide-react";
import { listCategories, type EntityCategory, type WorldEntity } from "../api";
import { EntityCreateModal } from "./EntityCreateModal";
import { useToast } from "./Toast";
import { replaceRangeWithMention } from "../utils/mentionText";
import { getActiveSelectionRange, type TextSelectionRange } from "../utils/selection";
import { defaultEntityCategoryId, entityNameFromSelection } from "../utils/worldbuilding";

interface AddEntityButtonProps {
  workId: number;
  text: string;
  onTextChange: (value: string) => void;
  label?: string;
}

/** Render a button that creates a setting entry from the current selection. */
export function AddEntityButton(props: AddEntityButtonProps): ReactElement {
  const { notify } = useToast();
  const capturedRange = useRef<TextSelectionRange | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [initialName, setInitialName] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState(0);

  async function openModal(): Promise<void> {
    const range = capturedRange.current;
    capturedRange.current = null;
    if (!range?.text.trim()) {
      notify("请先选择要加入设定的文字", "info");
      return;
    }
    try {
      const loaded = await listCategories(props.workId);
      if (loaded.length === 0) {
        notify("当前作品还没有设定种类", "error");
        return;
      }
      capturedRange.current = range;
      setCategories(loaded);
      setInitialName(entityNameFromSelection(range.text));
      setDefaultCategoryId(defaultEntityCategoryId(loaded));
      setModalOpen(true);
    } catch {
      notify("无法加载设定种类", "error");
    }
  }

  function handleClose(): void {
    capturedRange.current = null;
    setModalOpen(false);
  }

  function handleSaved(entity: WorldEntity): void {
    const range = capturedRange.current;
    if (range) {
      props.onTextChange(
        replaceRangeWithMention(props.text, range.start, range.end, entity.name),
      );
      capturedRange.current = null;
    }
    setModalOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="add-entity-btn"
        title="将选中的文字加入设定"
        onMouseDown={(event) => {
          event.preventDefault();
          capturedRange.current = getActiveSelectionRange();
        }}
        onClick={() => void openModal()}
      >
        <Sparkles size={15} />
        <span>{props.label ?? "加入设定"}</span>
      </button>
      <EntityCreateModal
        isOpen={modalOpen}
        workId={props.workId}
        categories={categories}
        defaultCategoryId={defaultCategoryId}
        initialName={initialName}
        onSaved={handleSaved}
        onClose={handleClose}
      />
    </>
  );
}
