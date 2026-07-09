/** Reusable "加入设定" action for outline editors.
 *
 * Captures the user's textarea selection, opens the create-entry modal with the
 * snippet as the default name, and on save replaces the selection with an
 * ``@名称`` reference marker in the parent field.
 */
import { useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { listCategories, type EntityCategory, type WorldEntity } from "../api";
import { EntityCreateModal } from "./EntityCreateModal";
import { SelectionActionPlus } from "./SelectionActionPlus";
import { useToast } from "./Toast";
import { replaceRangeWithMention } from "../utils/mentionText";
import { getActiveSelectionRange, type TextSelectionRange } from "../utils/selection";
import { defaultEntityCategoryId, entityNameFromSelection } from "../utils/worldbuilding";

interface AddEntityButtonProps {
  workId: number;
  text: string;
  onTextChange: (value: string) => void;
}

/** Render a compact button that creates a setting entry from the current selection. */
export function AddEntityButton(props: AddEntityButtonProps): ReactElement {
  const { t } = useTranslation("outline");
  const { notify } = useToast();
  const capturedRange = useRef<TextSelectionRange | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [initialName, setInitialName] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState(0);
  const label = t("selectionActions.addEntity.label");

  async function openModal(): Promise<void> {
    const range = capturedRange.current;
    capturedRange.current = null;
    if (!range?.text.trim()) {
      notify(t("selectionActions.addEntity.emptySelection"), "info");
      return;
    }
    try {
      const loaded = await listCategories(props.workId);
      if (loaded.length === 0) {
        notify(t("selectionActions.addEntity.noCategories"), "error");
        return;
      }
      capturedRange.current = range;
      setCategories(loaded);
      setInitialName(entityNameFromSelection(range.text));
      setDefaultCategoryId(defaultEntityCategoryId(loaded));
      setModalOpen(true);
    } catch {
      notify(t("selectionActions.addEntity.loadCategoriesFailed"), "error");
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
        className="selection-action-btn selection-action-entity"
        title={label}
        aria-label={label}
        onMouseDown={(event) => {
          event.preventDefault();
          capturedRange.current = getActiveSelectionRange();
        }}
        onClick={() => void openModal()}
      >
        <SelectionActionPlus />
        <Sparkles aria-hidden />
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
