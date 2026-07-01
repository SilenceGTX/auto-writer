/** Local-rewrite drawer with a diff preview (``WRITING_PAGE_DESSIGN.md`` §2.2).
 *
 * Lets the user describe how to rewrite the selected passage, requests the
 * rewrite, and previews the original vs. new text. It slides in from the right
 * with a transparent backdrop so the manuscript stays visible while comparing.
 * The original is only replaced once the user confirms.
 */
import { useState, type ReactElement } from "react";
import {
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Textarea,
  Tooltip,
} from "@heroui/react";
import { rewritePassage } from "../../api";
import { useToast } from "../../components/Toast";
import { surroundingParagraphs } from "../../utils/paragraphs";

interface RewriteDialogProps {
  isOpen: boolean;
  chapterId: number;
  selection: string;
  context?: string;
  /** Full chapter body and the selection's offsets, for 强化衔接 context. */
  content: string;
  selectionStart: number;
  selectionEnd: number;
  onApply: (rewritten: string) => void;
  onClose: () => void;
}

/** Render the rewrite instruction form and the original/rewritten diff preview. */
export function RewriteDialog(props: RewriteDialogProps): ReactElement {
  const { notify } = useToast();
  const [instruction, setInstruction] = useState("");
  const [strengthen, setStrengthen] = useState(false);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runRewrite(): Promise<void> {
    setLoading(true);
    try {
      const neighbors = strengthen
        ? surroundingParagraphs(props.content, props.selectionStart, props.selectionEnd)
        : { preceding: "", following: "" };
      const result = await rewritePassage(props.chapterId, {
        selection: props.selection,
        instruction: instruction.trim() || undefined,
        context: props.context,
        preceding: neighbors.preceding || undefined,
        following: neighbors.following || undefined,
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
    setStrengthen(false);
    setRewritten(null);
    props.onClose();
  }

  return (
    <Drawer
      isOpen={props.isOpen}
      onClose={handleClose}
      placement="right"
      backdrop="transparent"
      isDismissable={false}
      classNames={{ base: "rewrite-drawer" }}
    >
      <DrawerContent>
        <DrawerHeader>局部重写</DrawerHeader>
        <DrawerBody>
          <Textarea
            label="重写要求（可选）"
            minRows={2}
            value={instruction}
            onValueChange={setInstruction}
            placeholder="例如：更紧张、精简对话、改为第一人称…"
          />
          <Tooltip content="将选区前后各 2 个自然段作为上下文，让重写与前后文更连贯（仍只替换选区）">
            <Checkbox size="sm" isSelected={strengthen} onValueChange={setStrengthen}>
              强化衔接
            </Checkbox>
          </Tooltip>
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
        </DrawerBody>
        <DrawerFooter>
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
