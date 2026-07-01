/** Horizontal worldbuilding category tabs with add / delete (``§3.1``).
 *
 * Preset categories are not deletable; custom categories carry a delete button.
 * A trailing "添加种类" tab opens a modal to create a custom category.
 */
import { useState, type ReactElement } from "react";
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
  const { notify } = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name.trim()) {
      notify("请填写种类名称", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await createCategory(props.workId, name.trim());
      props.onCreated(created);
      setName("");
      setModalOpen(false);
      notify("种类已添加", "success");
    } catch {
      notify("添加种类失败（名称可能重复）", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="category-tabs" role="tablist" aria-label="设定种类">
      {props.categories.map((category) => (
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
            {category.name}
            <span className="category-tab-count">{category.entity_count}</span>
          </button>
          {category.is_preset === 0 && (
            <button
              type="button"
              className="category-tab-delete"
              aria-label={`删除种类 ${category.name}`}
              onClick={() => props.onRequestDelete(category)}
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      <Button
        size="sm"
        variant="flat"
        startContent={<Plus size={15} />}
        onPress={() => setModalOpen(true)}
      >
        添加种类
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>添加设定种类</ModalHeader>
          <ModalBody className="modal-form">
            <Input label="种类名称" value={name} onValueChange={setName} autoFocus />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              取消
            </Button>
            <Button color="primary" isLoading={saving} onPress={() => void handleCreate()}>
              添加
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
