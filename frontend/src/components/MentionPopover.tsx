/** Dropdown list of setting entries shown while typing an `@` mention.
 *
 * Presentational component shared by ``MentionTextarea`` and the writing editor;
 * the mention detection / search state is owned by ``useEntityMentions``.
 */
import type { ReactElement } from "react";
import type { WorldEntity } from "../api";

interface MentionPopoverProps {
  results: WorldEntity[];
  loading: boolean;
  onSelect: (entity: WorldEntity) => void;
}

/** Render the `@` mention results list (search/empty states included). */
export function MentionPopover(props: MentionPopoverProps): ReactElement {
  return (
    <div className="mention-popover" role="listbox">
      <div className="mention-popover-head">引用设定条目</div>
      {props.loading && <div className="mention-empty">搜索中…</div>}
      {!props.loading && props.results.length === 0 && (
        <div className="mention-empty">未找到设定条目</div>
      )}
      {!props.loading &&
        props.results.map((entity) => (
          <button
            key={entity.id}
            type="button"
            role="option"
            aria-selected={false}
            className="mention-option"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => props.onSelect(entity)}
          >
            <span className="mention-option-name">{entity.name}</span>
            {entity.description && (
              <span className="mention-option-desc">{entity.description}</span>
            )}
          </button>
        ))}
    </div>
  );
}
