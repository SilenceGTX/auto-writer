/** Textarea with `@` mention support for referencing worldbuilding entries.
 *
 * Implements the user-facing half of ``GENERAL_UI_DESIGN.md`` G4 / outline §4:
 * typing `@` opens a live search of the work's setting entries; selecting one
 * inserts an `@名称` reference marker at the caret. The backend resolves these
 * markers and injects the referenced entries' content into the AI prompt (see
 * ``backend/app/services/references.py``). Mention logic lives in the shared
 * ``useEntityMentions`` hook so other input surfaces reuse it.
 */
import { type ReactElement } from "react";
import { Textarea } from "@heroui/react";
import { useEntityMentions } from "../hooks/useEntityMentions";
import { MentionPopover } from "./MentionPopover";

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
  const mentions = useEntityMentions(props.workId);

  return (
    <div className="mention-field">
      <Textarea
        label={props.label}
        minRows={props.minRows}
        placeholder={props.placeholder}
        value={props.value}
        onValueChange={props.onValueChange}
        onKeyUp={(event) => mentions.detect(event.currentTarget)}
        onClick={(event) => mentions.detect(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && mentions.query !== null) {
            event.stopPropagation();
            mentions.close();
          }
        }}
        onBlur={() => window.setTimeout(() => mentions.close(), 120)}
      />
      {mentions.query !== null && (
        <MentionPopover
          results={mentions.results}
          loading={mentions.loading}
          onSelect={(entity) => mentions.insert(entity, props.value, props.onValueChange)}
        />
      )}
    </div>
  );
}
