/** Chapter body editor (``WRITING_PAGE_DESSIGN.md`` §2.2).
 *
 * A controlled textarea with a capped (5-step) undo/redo history, `@` setting
 * references, live word count, per-chapter scroll/caret memory, and toolbar
 * actions to quote the selection into the AI chat or trigger a local rewrite.
 */
import { useEffect, useRef, type ReactElement } from "react";
import { Button, Tooltip } from "@heroui/react";
import { Maximize2, Minimize2, MessageSquareQuote, Sparkles, WandSparkles } from "lucide-react";
import { useEntityMentions } from "../../hooks/useEntityMentions";
import { MentionPopover } from "../../components/MentionPopover";
import { SaveStatus, type SaveState } from "../../components/SaveStatus";
import { countWords } from "../../utils/wordCount";

const HISTORY_LIMIT = 5;

export interface ScrollMemory {
  scrollTop: number;
  caret: number;
}

interface ChapterEditorProps {
  workId: number;
  chapterId: number;
  value: string;
  onValueChange: (value: string) => void;
  saveState: SaveState;
  totalWordCount: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  generating: boolean;
  onGenerateDraft: () => void;
  onQuote: (text: string) => void;
  onRewrite: (selection: string, start: number, end: number) => void;
  memory: Map<number, ScrollMemory>;
  /** Text to select/scroll to after a 来源跳转 or 回插 (no-op if not found). */
  highlight?: string | null;
  onHighlightConsumed?: () => void;
}

/** Render the chapter text editor with history, mentions, and a status footer. */
export function ChapterEditor(props: ChapterEditorProps): ReactElement {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const mentions = useEntityMentions(props.workId);

  // Restore the remembered scroll/caret position when (re)mounting a chapter.
  useEffect(() => {
    const area = areaRef.current;
    const saved = props.memory.get(props.chapterId);
    if (area && saved) {
      area.scrollTop = saved.scrollTop;
      area.setSelectionRange(saved.caret, saved.caret);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.chapterId]);

  // Select and scroll to the highlight target (source jump / insert-back). If
  // the text is no longer present, just consume the request without selecting.
  useEffect(() => {
    if (!props.highlight) {
      return;
    }
    const area = areaRef.current;
    if (area) {
      const index = props.value.indexOf(props.highlight);
      if (index >= 0) {
        area.focus();
        area.setSelectionRange(index, index + props.highlight.length);
        // Approximate the selection's vertical position so it scrolls into view.
        area.scrollTop = (index / Math.max(props.value.length, 1)) * area.scrollHeight;
      }
    }
    props.onHighlightConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.highlight, props.value]);

  function remember(): void {
    const area = areaRef.current;
    if (area) {
      props.memory.set(props.chapterId, {
        scrollTop: area.scrollTop,
        caret: area.selectionStart ?? 0,
      });
    }
  }

  function pushHistory(): void {
    pastRef.current = [...pastRef.current, props.value].slice(-HISTORY_LIMIT);
    futureRef.current = [];
  }

  function handleInput(next: string): void {
    pushHistory();
    props.onValueChange(next);
    if (areaRef.current) {
      mentions.detect(areaRef.current);
    }
  }

  function undo(): void {
    if (pastRef.current.length === 0) {
      return;
    }
    futureRef.current = [props.value, ...futureRef.current];
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    props.onValueChange(previous);
  }

  function redo(): void {
    if (futureRef.current.length === 0) {
      return;
    }
    pastRef.current = [...pastRef.current, props.value].slice(-HISTORY_LIMIT);
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    props.onValueChange(next);
  }

  function selectedText(): { text: string; start: number; end: number } {
    const area = areaRef.current;
    if (!area || area.selectionStart === area.selectionEnd) {
      return { text: "", start: 0, end: 0 };
    }
    return {
      text: area.value.slice(area.selectionStart, area.selectionEnd),
      start: area.selectionStart,
      end: area.selectionEnd,
    };
  }

  return (
    <div className="chapter-editor">
      <div className="chapter-editor-toolbar">
        <Button
          size="sm"
          variant="flat"
          startContent={<Sparkles size={15} />}
          isLoading={props.generating}
          onPress={props.onGenerateDraft}
        >
          AI 生成本章
        </Button>
        <Tooltip content="将选中文字引用到 AI 对话">
          <Button
            size="sm"
            variant="flat"
            startContent={<MessageSquareQuote size={15} />}
            onPress={() => {
              const { text } = selectedText();
              if (text.trim()) props.onQuote(text.trim());
            }}
          >
            引用到对话
          </Button>
        </Tooltip>
        <Tooltip content="让 AI 重写选中段落">
          <Button
            size="sm"
            variant="flat"
            startContent={<WandSparkles size={15} />}
            onPress={() => {
              const { text, start, end } = selectedText();
              if (text.trim()) props.onRewrite(text, start, end);
            }}
          >
            重写选中
          </Button>
        </Tooltip>
        <Tooltip content={props.focusMode ? "退出专注模式" : "专注模式"}>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={props.focusMode ? "退出专注模式" : "专注模式"}
            onPress={props.onToggleFocus}
          >
            {props.focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
        </Tooltip>
      </div>

      <div className="mention-field chapter-editor-body">
        <textarea
          ref={areaRef}
          className="chapter-editor-area"
          value={props.value}
          placeholder="在此撰写本章正文…（输入 @ 引用设定，Ctrl/Cmd+Z 撤销）"
          onChange={(event) => handleInput(event.target.value)}
          onScroll={remember}
          onKeyUp={(event) => {
            remember();
            mentions.detect(event.currentTarget);
          }}
          onClick={(event) => mentions.detect(event.currentTarget)}
          onKeyDown={(event) => {
            const mod = event.ctrlKey || event.metaKey;
            if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
              event.preventDefault();
              undo();
            } else if (mod && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
              event.preventDefault();
              redo();
            } else if (event.key === "Escape" && mentions.query !== null) {
              event.stopPropagation();
              mentions.close();
            }
          }}
          onBlur={() => {
            remember();
            window.setTimeout(() => mentions.close(), 120);
          }}
        />
        {mentions.query !== null && (
          <MentionPopover
            results={mentions.results}
            loading={mentions.loading}
            onSelect={(entity) => {
              pushHistory();
              mentions.insert(entity, props.value, props.onValueChange);
            }}
          />
        )}
      </div>

      <div className="chapter-editor-footer">
        <SaveStatus state={props.saveState} />
        <span className="chapter-editor-count">
          本章 {countWords(props.value)} 字 · 全书 {props.totalWordCount} 字
        </span>
      </div>
    </div>
  );
}
