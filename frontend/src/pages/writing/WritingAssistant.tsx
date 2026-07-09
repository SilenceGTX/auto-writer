/** Writing assistant panel: AI chat, 前情提要, and 加入灵感 (``WRITING_PAGE_DESSIGN.md`` §3). */
import { useEffect, useState, type ReactElement } from "react";
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

interface WritingAssistantProps {
  workId: number;
  chapterId: number;
  quoted: string | null;
  onClearQuote: () => void;
}

/** Render the chat, recap, and inspiration controls for the current chapter. */
export function WritingAssistant(props: WritingAssistantProps): ReactElement {
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
      const { messages: updated } = await sendWritingChat(props.workId, {
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
      await clearWritingChatMemory(props.workId, props.chapterId);
      setMessages([]);
      setConfirmClear(false);
      notify("对话记忆已清空", "success");
    } catch {
      notify("清空对话记忆失败", "error");
    } finally {
      setClearing(false);
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
            labelKey="selectionActions.addInspiration.saveFallback"
          />
        </div>
      )}

      <div className="chat-log">
        {!loadingHistory && messages.length === 0 && (
          <p className="assistant-hint">向 AI 提问、请求续写或润色建议；可用 @ 引用设定。</p>
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
        placeholder="输入消息，@ 可引用设定…"
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
        body="将删除本章写作助手下的全部对话记录，且无法恢复。"
        confirmLabel="清空"
        danger
        onConfirm={() => void handleClearMemory()}
        onCancel={() => setConfirmClear(false)}
      />

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
