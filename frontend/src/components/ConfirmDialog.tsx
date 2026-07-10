/** Reusable confirmation dialog for destructive/irreversible actions (rule G1). */
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Render a modal asking the user to confirm or cancel an action.

The backdrop is non-dismissable so the choice must be made via the buttons,
preventing accidental dismissal (per the project UX rules). */
export function ConfirmDialog(props: ConfirmDialogProps): ReactElement {
  const { t } = useTranslation("common");

  return (
    <Modal isOpen={props.isOpen} onClose={props.onCancel} isDismissable={false}>
      <ModalContent>
        <ModalHeader>{props.title}</ModalHeader>
        {props.body ? <ModalBody>{props.body}</ModalBody> : null}
        <ModalFooter>
          <Button variant="light" onPress={props.onCancel}>
            {props.cancelLabel ?? t("cancel")}
          </Button>
          <Button color={props.danger ? "danger" : "primary"} onPress={props.onConfirm}>
            {props.confirmLabel ?? t("confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
