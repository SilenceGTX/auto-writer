/** Reusable confirmation dialog with backdrop overlay. */
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="confirm-message">{message}</div>
        <div className="modal-actions">
          <button
            className={danger ? "danger" : ""}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="secondary" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
