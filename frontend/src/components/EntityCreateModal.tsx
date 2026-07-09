/** Modal wrapper around ``EntityForm`` for creating a setting entry from another page. */
import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import type { EntityCategory, WorldEntity } from "../api";
import { EntityForm } from "../pages/worldbuilding/EntityForm";

interface EntityCreateModalProps {
  isOpen: boolean;
  workId: number;
  categories: EntityCategory[];
  defaultCategoryId: number;
  initialName: string;
  onSaved: (entity: WorldEntity) => void;
  onClose: () => void;
}

/** Render the create-entry form inside a modal dialog. */
export function EntityCreateModal(props: EntityCreateModalProps): ReactElement {
  const { t } = useTranslation("concept");

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{ base: "entity-create-modal" }}
    >
      <ModalContent>
        <ModalHeader>{t("modal.createTitle")}</ModalHeader>
        <ModalBody>
          <EntityForm
            key={`${props.initialName}-${props.defaultCategoryId}`}
            embedded
            workId={props.workId}
            categories={props.categories}
            defaultCategoryId={props.defaultCategoryId}
            entity={null}
            initialName={props.initialName}
            onSaved={props.onSaved}
            onCancel={props.onClose}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
