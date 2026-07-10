/** Review assistant panel: AI review chat with quoted passages (``REVIEW_PAGE_DESIGN.md`` §3).
 *
 * Lets the user discuss the manuscript with an editor-style AI; a passage quoted
 * from the reader is attached to the next message. Reuses the ``@`` mention
 * textarea and the global "加入灵感" action.
 */
import { useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heroui/react";
import { Send, Trash2, X } from "lucide-react";
import {
  clearReviewChatMemory,
  getReviewChatMessages,
  sendReviewChat,
  type AssistantChatMessage,
} from "../../api";
import { AddInspirationButton } from "../../components/AddInspirationButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";
import { translateReviewApiError } from "../../utils/reviewApiError";

interface ReviewAssistantProps {
  workId: number;
  chapterId: number | null;
  quoted: string | null;
  onClearQuote: () => void;
}

/** Render the review chat and inspiration controls for the current chapter. */
export function ReviewAssistant(props: ReviewAssistantProps): ReactElement {
  const { t } = useTranslation(["review", "common", "errors"]);
  const { notify } = useToast();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    void getReviewChatMessages(props.workId, props.chapterId)
      .then((history) => {
        if (active) {
          setMessages(history);
        }
      })
      .catch(() => {
        if (active) {
          notify(t("review:toast.loadChatFailed"), "error");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });
    return () => {
      active = false;
    };
  }, [props.workId, props.chapterId, notify, t]);

  async function handleSend(): Promise<void> {
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput("");
    setSending(true);
    try {
      const { messages: updated } = await sendReviewChat(props.workId, {
        content: text,
        chapter_id: props.chapterId,
        quoted: props.quoted,
      });
      setMessages(updated);
      props.onClearQuote();
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(translateReviewApiError(message, t, "review:toast.chatFailed"), "error");
    } finally {
      setSending(false);
    }
  }

  async function handleClearMemory(): Promise<void> {
    setClearing(true);
    try {
      await clearReviewChatMemory(props.workId, props.chapterId);
      setMessages([]);
      setConfirmClear(false);
      notify(t("review:toast.memoryCleared"), "success");
    } catch {
      notify(t("review:toast.clearMemoryFailed"), "error");
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="assistant-section writing-assistant">
      <div className="writing-assistant-head">
        <h2>{t("review:assistant.title")}</h2>
      </div>

      <div className="chat-log">
        {!loadingHistory && messages.length === 0 && (
          <p className="assistant-hint">{t("review:assistant.emptyHint")}</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble chat-${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      {props.quoted && (
        <div className="chat-quote">
          <span>{t("review:assistant.quoteLabel", { text: props.quoted })}</span>
          <button
            type="button"
            aria-label={t("review:assistant.removeQuoteAria")}
            onClick={props.onClearQuote}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <MentionTextarea
        workId={props.workId}
        value={input}
        onValueChange={setInput}
        minRows={3}
        placeholder={t("review:assistant.inputPlaceholder")}
      />
      <div className="form-actions form-actions-stacked">
        <AddInspirationButton
          source={{
            source_page: "review",
            work_id: props.workId,
            chapter_id: props.chapterId,
          }}
        />
        <div className="form-actions-row">
          <Button
            color="danger"
            variant="flat"
            startContent={<Trash2 size={15} />}
            isDisabled={messages.length === 0 || sending}
            isLoading={clearing}
            onPress={() => setConfirmClear(true)}
          >
            {t("review:assistant.clearMemory")}
          </Button>
          <Button
            color="primary"
            startContent={<Send size={15} />}
            isLoading={sending}
            onPress={() => void handleSend()}
          >
            {t("review:assistant.send")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmClear}
        title={t("review:clearDialog.title")}
        body={t("review:clearDialog.body")}
        confirmLabel={t("review:clearDialog.confirm")}
        danger
        onConfirm={() => void handleClearMemory()}
        onCancel={() => setConfirmClear(false)}
      />
    </section>
  );
}
