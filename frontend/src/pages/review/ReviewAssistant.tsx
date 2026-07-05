/** Review assistant panel: AI review chat with quoted passages (``REVIEW_PAGE_DESIGN.md`` §3).
 *
 * Lets the user discuss the manuscript with an editor-style AI; a passage quoted
 * from the reader is attached to the next message. Reuses the ``@`` mention
 * textarea and the global "加入灵感" action.
 */
import { useEffect, useState, type ReactElement } from "react";
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

interface ReviewAssistantProps {
  workId: number;
  chapterId: number | null;
  quoted: string | null;
  onClearQuote: () => void;
}

/** Render the review chat and inspiration controls for the current chapter. */
export function ReviewAssistant(props: ReviewAssistantProps): ReactElement {
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
          notify("无法加载对话历史", "error");
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
  }, [props.workId, props.chapterId, notify]);

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
    } catch {
      notify("AI 回复失败，请检查 LLM 连接", "error");
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
      notify("对话记忆已清空", "success");
    } catch {
      notify("清空对话记忆失败", "error");
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="assistant-section writing-assistant">
      <div className="writing-assistant-head">
        <h2>审阅助手</h2>
      </div>

      <div className="chat-log">
        {!loadingHistory && messages.length === 0 && (
          <p className="assistant-hint">
            选中正文片段后点击「引用到审阅」，请 AI 检查情节、设定与文字问题。
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble chat-${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      {props.quoted && (
        <div className="chat-quote">
          <span>引用：{props.quoted}</span>
          <button type="button" aria-label="移除引用" onClick={props.onClearQuote}>
            <X size={14} />
          </button>
        </div>
      )}

      <MentionTextarea
        workId={props.workId}
        value={input}
        onValueChange={setInput}
        minRows={3}
        placeholder="向 AI 提问或请求审阅意见，@ 可引用设定…"
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
            清空记忆
          </Button>
          <Button
            color="primary"
            startContent={<Send size={15} />}
            isLoading={sending}
            onPress={() => void handleSend()}
          >
            发送
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmClear}
        title="清空对话记忆"
        body="将删除本章节审阅助手下的全部对话记录，且无法恢复。"
        confirmLabel="清空"
        danger
        onConfirm={() => void handleClearMemory()}
        onCancel={() => setConfirmClear(false)}
      />
    </section>
  );
}
