/** Writing assistant panel: AI chat, 前情提要, and 加入灵感 (``WRITING_PAGE_DESSIGN.md`` §3). */
import { useState, type ReactElement } from "react";
import { Button } from "@heroui/react";
import { History, Send, X } from "lucide-react";
import {
  generateRecap,
  getRecap,
  sendWritingChat,
  type ChatMessage,
} from "../../api";
import { AddInspirationButton } from "../../components/AddInspirationButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { MentionTextarea } from "../../components/MentionTextarea";
import { useToast } from "../../components/Toast";

interface WritingAssistantProps {
  workId: number;
  chapterId: number;
  quoted: string | null;
  onClearQuote: () => void;
}

/** Render the chat, recap, and inspiration controls for the current chapter. */
export function WritingAssistant(props: WritingAssistantProps): ReactElement {
  const { notify } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recap, setRecap] = useState<string | null>(null);
  const [recapBusy, setRecapBusy] = useState(false);
  const [askRestale, setAskRestale] = useState(false);

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
      const { reply } = await sendWritingChat(props.workId, {
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

  async function runGenerateRecap(): Promise<void> {
    setRecapBusy(true);
    try {
      const result = await generateRecap(props.chapterId);
      setRecap(result.recap);
    } catch {
      notify("生成前情提要失败", "error");
    } finally {
      setRecapBusy(false);
    }
  }

  async function handleRecap(): Promise<void> {
    setRecapBusy(true);
    try {
      const result = await getRecap(props.chapterId);
      if (!result.has_previous) {
        notify("这是第一章，没有前情提要", "info");
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
    } catch {
      notify("获取前情提要失败", "error");
    } finally {
      setRecapBusy(false);
    }
  }

  return (
    <section className="assistant-section writing-assistant">
      <div className="writing-assistant-head">
        <h2>写作助手</h2>
        <Button
          size="sm"
          variant="flat"
          startContent={<History size={15} />}
          isLoading={recapBusy}
          onPress={() => void handleRecap()}
        >
          前情提要
        </Button>
      </div>

      {recap && (
        <div className="recap-box">
          <div className="recap-box-head">
            <strong>前情提要</strong>
            <button type="button" aria-label="关闭前情提要" onClick={() => setRecap(null)}>
              <X size={14} />
            </button>
          </div>
          <p>{recap}</p>
          <AddInspirationButton
            source={{ source_page: "writing", work_id: props.workId, chapter_id: props.chapterId }}
            getFallbackText={() => recap}
            label="存为灵感"
          />
        </div>
      )}

      <div className="chat-log">
        {messages.length === 0 && (
          <p className="assistant-hint">向 AI 提问、请求续写或润色建议；可用 @ 引用设定。</p>
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
        placeholder="输入消息，@ 可引用设定…"
      />
      <div className="form-actions">
        <AddInspirationButton
          source={{ source_page: "writing", work_id: props.workId, chapter_id: props.chapterId }}
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

      <ConfirmDialog
        isOpen={askRestale}
        title="前一章节有改动"
        body="前一章节在生成提要后被修改，是否重新总结？"
        confirmLabel="重新总结"
        cancelLabel="使用旧提要"
        onConfirm={() => {
          setAskRestale(false);
          void runGenerateRecap();
        }}
        onCancel={() => setAskRestale(false)}
      />
    </section>
  );
}
