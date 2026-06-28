/** Textarea with `@` mention support for referencing worldbuilding entries.
 *
 * Implements the user-facing half of ``GENERAL_UI_DESIGN.md`` G4 / outline §4:
 * typing `@` opens a live search of the work's setting entries; selecting one
 * inserts an `@名称` reference marker at the caret. The backend resolves these
 * markers and injects the referenced entries' content into the AI prompt (see
 * ``backend/app/services/references.py``).
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { Textarea } from "@heroui/react";
import { listEntities, type WorldEntity } from "../api";

const MAX_RESULTS = 8;
// Trigger on any `@token` at the caret. CJK text rarely puts a space before
// `@`, so we intentionally do not require a leading whitespace boundary.
const MENTION_PATTERN = /@([^\s@]*)$/;

interface MentionTextareaProps {
  workId: number;
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  minRows?: number;
  placeholder?: string;
}

/** A HeroUI Textarea that offers `@` entity references via a search dropdown. */
export function MentionTextarea(props: MentionTextareaProps): ReactElement {
  type TextEl = HTMLTextAreaElement | HTMLInputElement;
  const taRef = useRef<TextEl | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [results, setResults] = useState<WorldEntity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query === null) {
      return;
    }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await listEntities(props.workId, {
            search: query,
            pageSize: MAX_RESULTS,
          });
          if (active) setResults(data.items);
        } catch {
          if (active) setResults([]);
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, props.workId]);

  /** Inspect the caret context to decide whether an `@` mention is active. */
  function detect(element: TextEl): void {
    taRef.current = element;
    const caret = element.selectionStart ?? element.value.length;
    const before = element.value.slice(0, caret);
    const match = MENTION_PATTERN.exec(before);
    if (match) {
      setMentionStart(caret - match[1].length - 1);
      setQuery(match[1]);
    } else {
      setQuery(null);
    }
  }

  /** Replace the active `@query` token with the chosen entity reference. */
  function insert(entity: WorldEntity): void {
    const element = taRef.current;
    const caret = element ? (element.selectionStart ?? props.value.length) : props.value.length;
    const before = props.value.slice(0, mentionStart);
    const after = props.value.slice(caret);
    const marker = `@${entity.name} `;
    props.onValueChange(before + marker + after);
    setQuery(null);
    requestAnimationFrame(() => {
      if (element) {
        const position = before.length + marker.length;
        element.focus();
        element.setSelectionRange(position, position);
      }
    });
  }

  return (
    <div className="mention-field">
      <Textarea
        label={props.label}
        minRows={props.minRows}
        placeholder={props.placeholder}
        value={props.value}
        onValueChange={props.onValueChange}
        onKeyUp={(event) => detect(event.currentTarget)}
        onClick={(event) => detect(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query !== null) {
            event.stopPropagation();
            setQuery(null);
          }
        }}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
      />
      {query !== null && (
        <div className="mention-popover" role="listbox">
          <div className="mention-popover-head">引用设定条目</div>
          {loading && <div className="mention-empty">搜索中…</div>}
          {!loading && results.length === 0 && (
            <div className="mention-empty">未找到设定条目</div>
          )}
          {!loading &&
            results.map((entity) => (
              <button
                key={entity.id}
                type="button"
                role="option"
                aria-selected={false}
                className="mention-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(entity)}
              >
                <span className="mention-option-name">{entity.name}</span>
                {entity.description && (
                  <span className="mention-option-desc">{entity.description}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
