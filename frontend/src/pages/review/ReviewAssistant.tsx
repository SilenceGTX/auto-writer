/** Review assistant panel: AI review chat with quoted passages (``REVIEW_PAGE_DESIGN.md`` §3).
 *
 * Lets the user discuss the manuscript with an editor-style AI; a passage quoted
 * from the reader is attached to the next message. Reuses the ``@`` mention
 * textarea and the global "加入灵感" action.
 */
import { useState, type ReactElement } from "react";
import { Button } from "@heroui/react";
import { Send, X } from "lucide-react";
import { sendReviewChat, type ChatMessage } from "../../api";
import { AddInspirationButton } from "../../components/AddInspirationButton";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(): Promise<void> {
    const text = input.trim();
    if (!text) {
      return;
    }
    const next = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { reply } = await sendReviewChat(props.workId, {
        messages: next,
        chapter_id: props.chapterId,
        quoted: props.quoted,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
      props.onClearQuote();
    } catch {
      notify("AI 回复失败，请检查 LLM 连接", "error");
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="assistant-section writing-assistant">
      <div className="writing-assistant-head">
        <h2>审阅助手</h2>
      </div>

      <div className="chat-log">
        {messages.length === 0 && (
          <p className="assistant-hint">
            选中正文片段后点击「引用到审阅」，请 AI 检查情节、设定与文字问题。
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble chat-${message.role}`}>
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
      <div className="form-actions">
        <AddInspirationButton
          source={{
            source_page: "review",
            work_id: props.workId,
            chapter_id: props.chapterId,
          }}
        />
        <Button
          color="primary"
          startContent={<Send size={15} />}
          isLoading={sending}
          onPress={() => void handleSend()}
        >
          发送
        </Button>
      </div>
    </section>
  );
}
