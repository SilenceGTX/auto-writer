/** Local-rewrite dialog with a diff preview (``WRITING_PAGE_DESSIGN.md`` §2.2).
 *
 * Lets the user describe how to rewrite the selected passage, requests the
 * rewrite, and previews the original vs. new text side by side. The original is
 * only replaced once the user confirms.
 */
import { useState, type ReactElement } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { rewritePassage } from "../../api";
import { useToast } from "../../components/Toast";

interface RewriteDialogProps {
  isOpen: boolean;
  chapterId: number;
  selection: string;
  context?: string;
  onApply: (rewritten: string) => void;
  onClose: () => void;
}

/** Render the rewrite instruction form and the original/rewritten diff preview. */
export function RewriteDialog(props: RewriteDialogProps): ReactElement {
  const { notify } = useToast();
  const [instruction, setInstruction] = useState("");
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runRewrite(): Promise<void> {
    setLoading(true);
    try {
      const result = await rewritePassage(props.chapterId, {
        selection: props.selection,
        instruction: instruction.trim() || undefined,
        context: props.context,
      });
      setRewritten(result.rewritten);
    } catch {
      notify("重写失败，请检查 LLM 连接", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(): void {
    setInstruction("");
    setRewritten(null);
    props.onClose();
  }

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose} size="3xl" isDismissable={false}>
      <ModalContent>
        <ModalHeader>局部重写</ModalHeader>
        <ModalBody>
          <Textarea
            label="重写要求（可选）"
            minRows={2}
            value={instruction}
            onValueChange={setInstruction}
            placeholder="例如：更紧张、精简对话、改为第一人称…"
          />
          {rewritten !== null && (
            <div className="rewrite-diff">
              <div className="rewrite-pane">
                <h4>原文</h4>
                <p>{props.selection}</p>
              </div>
              <div className="rewrite-pane rewrite-pane-new">
                <h4>重写</h4>
                <p>{rewritten}</p>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            取消
          </Button>
          <Button variant="flat" isLoading={loading} onPress={() => void runRewrite()}>
            {rewritten === null ? "生成重写" : "重新生成"}
          </Button>
          <Button
            color="primary"
            isDisabled={rewritten === null}
            onPress={() => {
              if (rewritten !== null) {
                props.onApply(rewritten);
                handleClose();
              }
            }}
          >
            应用替换
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
