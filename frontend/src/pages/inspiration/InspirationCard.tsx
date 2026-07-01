/** A single inspiration card in the inspiration page grid.
 *
 * Shows a content preview, its source badge and capture time, and its tag
 * chips. Clicking the card opens the detail modal (``INSIGHTS_PAGE_DESIGN.md``
 * §2.1).
 */
import type { ReactElement } from "react";
import { Chip } from "@heroui/react";
import { Clock } from "lucide-react";
import type { Inspiration } from "../../api";
import { formatTimestamp, sourceLabel } from "../../utils/inspiration";

interface InspirationCardProps {
  inspiration: Inspiration;
  onOpen: (inspiration: Inspiration) => void;
}

/** Render a clickable inspiration preview card. */
export function InspirationCard(props: InspirationCardProps): ReactElement {
  const { inspiration } = props;
  return (
    <button
      type="button"
      className="inspiration-card"
      onClick={() => props.onOpen(inspiration)}
    >
      <p className="inspiration-card-content">{inspiration.content}</p>
      <div className="inspiration-card-tags">
        {inspiration.tags.map((tag) => (
          <Chip
            key={tag.id}
            size="sm"
            variant="flat"
            style={tag.color ? { backgroundColor: tag.color, color: "#fff" } : undefined}
          >
            {tag.name}
          </Chip>
        ))}
      </div>
      <div className="inspiration-card-meta">
        <span className="inspiration-source-badge">{sourceLabel(inspiration.source_page)}</span>
        <span className="inspiration-card-time">
          <Clock size={12} />
          {formatTimestamp(inspiration.created_at)}
        </span>
      </div>
    </button>
  );
}
