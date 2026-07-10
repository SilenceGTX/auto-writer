/** Writing assistant panel: AI chat, 前情提要, and 加入灵感 (``WRITING_PAGE_DESSIGN.md`` §3). */
import { useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heroui/react";
import { History, Send, Trash2, X } from "lucide-react";
import {
  clearWritingChatMemory,
  generateRecap,
  getRecap,
  getWritingChatMessages,
  sendWritingChat,
  type AssistantChatMessage,
} from "../../api";
import { AddInspirationButton } from "../../components/AddInspirationButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";
import { translateWritingApiError } from "../../utils/writingApiError";

interface WritingAssistantProps {
  workId: number;
  chapterId: number;
  quoted: string | null;
  onClearQuote: () => void;
}

/** Render the chat, recap, and inspiration controls for the current chapter. */
export function WritingAssistant(props: WritingAssistantProps): ReactElement {
  const { t } = useTranslation(["writing", "common", "errors"]);
  const { notify } = useToast();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [recap, setRecap] = useState<string | null>(null);
  const [recapBusy, setRecapBusy] = useState(false);
  const [askRestale, setAskRestale] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    void getWritingChatMessages(props.workId, props.chapterId)
      .then((history) => {
        if (active) {
          setMessages(history);
        }
      })
      .catch(() => {
        if (active) {
          notify(t("writing:toast.loadChatFailed"), "error");
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
      const { messages: updated } = await sendWritingChat(props.workId, {
        content: text,
        chapter_id: props.chapterId,
        quoted: props.quoted,
      });
      setMessages(updated);
      props.onClearQuote();
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(translateWritingApiError(message, t, "writing:toast.chatFailed"), "error");
    } finally {
      setSending(false);
    }
  }

  async function handleClearMemory(): Promise<void> {
    setClearing(true);
    try {
      await clearWritingChatMemory(props.workId, props.chapterId);
      setMessages([]);
      setConfirmClear(false);
      notify(t("writing:toast.memoryCleared"), "success");
    } catch {
      notify(t("writing:toast.clearMemoryFailed"), "error");
    } finally {
      setClearing(false);
    }
  }

  async function runGenerateRecap(): Promise<void> {
    setRecapBusy(true);
    try {
      const result = await generateRecap(props.chapterId);
      setRecap(result.recap);
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(
        translateWritingApiError(message, t, "writing:toast.generateRecapFailed"),
        "error",
      );
    } finally {
      setRecapBusy(false);
    }
  }

  async function handleRecap(): Promise<void> {
    setRecapBusy(true);
    try {
      const result = await getRecap(props.chapterId);
      if (!result.has_previous) {
        notify(t("writing:toast.noRecapFirstChapter"), "info");
        return;
      }
      if (result.cached && result.stale) {
        setRecap(result.recap);
        setAskRestale(true);
        return;
      }
      if (result.cached) {
        setRecap(result.recap);
        return;
      }
      await runGenerateRecap();
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      notify(translateWritingApiError(message, t, "writing:toast.getRecapFailed"), "error");
    } finally {
      setRecapBusy(false);
    }
  }

  return (
    <section className="assistant-section writing-assistant">
      <div className="writing-assistant-head">
        <h2>{t("writing:assistant.title")}</h2>
        <Button
          size="sm"
          variant="flat"
          startContent={<History size={15} />}
          isLoading={recapBusy}
          onPress={() => void handleRecap()}
        >
          {t("writing:assistant.recap")}
        </Button>
      </div>

      {recap && (
        <div className="recap-box">
          <div className="recap-box-head">
            <strong>{t("writing:assistant.recap")}</strong>
            <button
              type="button"
              aria-label={t("writing:assistant.closeRecapAria")}
              onClick={() => setRecap(null)}
            >
              <X size={14} />
            </button>
          </div>
          <p>{recap}</p>
        </div>
      )}

      <div className="chat-log">
        {!loadingHistory && messages.length === 0 && (
          <p className="assistant-hint">{t("writing:assistant.emptyHint")}</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble chat-${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      {props.quoted && (
        <div className="chat-quote">
          <span>{t("writing:assistant.quoteLabel", { text: props.quoted })}</span>
          <button
            type="button"
            aria-label={t("writing:assistant.removeQuoteAria")}
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
        placeholder={t("writing:assistant.inputPlaceholder")}
      />
      <div className="form-actions form-actions-stacked">
        <AddInspirationButton
          source={{ source_page: "writing", work_id: props.workId, chapter_id: props.chapterId }}
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
            {t("writing:assistant.clearMemory")}
          </Button>
          <Button
            color="primary"
            startContent={<Send size={15} />}
            isLoading={sending}
            onPress={() => void handleSend()}
          >
            {t("writing:assistant.send")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmClear}
        title={t("writing:clearDialog.title")}
        body={t("writing:clearDialog.body")}
        confirmLabel={t("writing:clearDialog.confirm")}
        danger
        onConfirm={() => void handleClearMemory()}
        onCancel={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        isOpen={askRestale}
        title={t("writing:staleRecapDialog.title")}
        body={t("writing:staleRecapDialog.body")}
        confirmLabel={t("writing:staleRecapDialog.confirm")}
        cancelLabel={t("writing:staleRecapDialog.cancel")}
        onConfirm={() => {
          setAskRestale(false);
          void runGenerateRecap();
        }}
        onCancel={() => setAskRestale(false)}
      />
    </section>
  );
}
