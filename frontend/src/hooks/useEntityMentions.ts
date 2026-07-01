/** Hook powering `@` setting-entry references in text fields (G4 / outline §4).
 *
 * Detects an `@token` at the caret of a textarea/input, runs a debounced live
 * search of the work's setting entries, and inserts the chosen `@名称` marker.
 * Shared by ``MentionTextarea`` and the writing editor so the behavior stays
 * consistent across input surfaces.
 */
import { useEffect, useRef, useState } from "react";
import { listEntities, type WorldEntity } from "../api";

export type MentionElement = HTMLTextAreaElement | HTMLInputElement;

const MAX_RESULTS = 8;
// Trigger on any `@token` at the caret. CJK text rarely puts a space before
// `@`, so we intentionally do not require a leading whitespace boundary.
const MENTION_PATTERN = /@([^\s@]*)$/;

interface UseEntityMentions {
  query: string | null;
  results: WorldEntity[];
  loading: boolean;
  detect: (element: MentionElement) => void;
  insert: (entity: WorldEntity, value: string, onValueChange: (value: string) => void) => void;
  close: () => void;
}

/** Manage `@` mention detection, search, and insertion for one input field. */
export function useEntityMentions(workId: number): UseEntityMentions {
  const elementRef = useRef<MentionElement | null>(null);
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
          const data = await listEntities(workId, { search: query, pageSize: MAX_RESULTS });
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
  }, [query, workId]);

  function detect(element: MentionElement): void {
    elementRef.current = element;
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

  function insert(
    entity: WorldEntity,
    value: string,
    onValueChange: (value: string) => void,
  ): void {
    const element = elementRef.current;
    const caret = element ? (element.selectionStart ?? value.length) : value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const marker = `@${entity.name} `;
    onValueChange(before + marker + after);
    setQuery(null);
    requestAnimationFrame(() => {
      if (element) {
        const position = before.length + marker.length;
        element.focus();
        element.setSelectionRange(position, position);
      }
    });
  }

  return { query, results, loading, detect, insert, close: () => setQuery(null) };
}
