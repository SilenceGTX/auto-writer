/** Local-rewrite drawer with a diff preview (``WRITING_PAGE_DESSIGN.md`` §2.2).
 *
 * Lets the user describe how to rewrite the selected passage, requests the
 * rewrite, and previews the original vs. new text. It slides in from the right
 * with a transparent backdrop so the manuscript stays visible while comparing.
 * The original is only replaced once the user confirms.
 */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
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
import { translateWritingApiError } from "../../utils/writingApiError";

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
  const { t } = useTranslation(["writing", "common", "errors"]);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(translateWritingApiError(message, t, "writing:toast.rewriteFailed"), "error");
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
        <DrawerHeader>{t("writing:rewrite.title")}</DrawerHeader>
        <DrawerBody>
          <Textarea
            label={t("writing:rewrite.instructionLabel")}
            minRows={2}
            value={instruction}
            onValueChange={setInstruction}
            placeholder={t("writing:rewrite.instructionPlaceholder")}
          />
          <Tooltip content={t("writing:rewrite.strengthenTooltip")}>
            <Checkbox size="sm" isSelected={strengthen} onValueChange={setStrengthen}>
              {t("writing:rewrite.strengthen")}
            </Checkbox>
          </Tooltip>
          {rewritten !== null && (
            <div className="rewrite-diff">
              <div className="rewrite-pane">
                <h4>{t("writing:rewrite.original")}</h4>
                <p>{props.selection}</p>
              </div>
              <div className="rewrite-pane rewrite-pane-new">
                <h4>{t("writing:rewrite.rewritten")}</h4>
                <p>{rewritten}</p>
              </div>
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="light" onPress={handleClose}>
            {t("common:cancel")}
          </Button>
          <Button variant="flat" isLoading={loading} onPress={() => void runRewrite()}>
            {rewritten === null ? t("writing:rewrite.generate") : t("writing:rewrite.regenerate")}
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
            {t("writing:rewrite.apply")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
