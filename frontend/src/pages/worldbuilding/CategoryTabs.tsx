/** Horizontal worldbuilding category tabs with add / delete (``§3.1``).
 *
 * Preset categories are not deletable; custom categories carry a delete button.
 * A trailing "添加种类" tab opens a modal to create a custom category.
 */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Plus, X } from "lucide-react";
import { createCategory, type EntityCategory } from "../../api";
import { useToast } from "../../components/Toast";
import { translateCategoryName } from "../../utils/entityCategoryI18n";

interface CategoryTabsProps {
  workId: number;
  categories: EntityCategory[];
  activeId: number | null;
  onSelect: (categoryId: number) => void;
  onCreated: (category: EntityCategory) => void;
  onRequestDelete: (category: EntityCategory) => void;
}

/** Render the category tab bar and the custom-category creation modal. */
export function CategoryTabs(props: CategoryTabsProps): ReactElement {
  const { t } = useTranslation(["concept", "common"]);
  const { notify } = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name.trim()) {
      notify(t("concept:toast.categoryNameRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      const created = await createCategory(props.workId, name.trim());
      props.onCreated(created);
      setName("");
      setModalOpen(false);
      notify(t("concept:toast.categoryAdded"), "success");
    } catch {
      notify(t("concept:toast.categoryAddFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="category-tabs" role="tablist" aria-label={t("concept:categories.ariaLabel")}>
      {props.categories.map((category) => {
        const label = translateCategoryName(category, t);
        return (
          <div
            key={category.id}
            className={`category-tab ${category.id === props.activeId ? "active" : ""}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={category.id === props.activeId}
              className="category-tab-label"
              onClick={() => props.onSelect(category.id)}
            >
              {label}
              <span className="category-tab-count">{category.entity_count}</span>
            </button>
            {category.is_preset === 0 && (
              <button
                type="button"
                className="category-tab-delete"
                aria-label={t("concept:categories.deleteAria", { name: label })}
                onClick={() => props.onRequestDelete(category)}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        variant="flat"
        startContent={<Plus size={15} />}
        onPress={() => setModalOpen(true)}
      >
        {t("concept:categories.add")}
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>{t("concept:categories.modalTitle")}</ModalHeader>
          <ModalBody className="modal-form">
            <Input
              label={t("concept:categories.nameLabel")}
              value={name}
              onValueChange={setName}
              autoFocus
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
              {t("concept:categories.addButton")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
