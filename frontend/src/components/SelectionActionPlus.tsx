/** Compact ``+ icon`` action buttons used beside outline and assistant editors. */
import { Plus } from "lucide-react";
import type { ReactElement } from "react";

interface SelectionActionPlusProps {
  className?: string;
}

/** Render a bold plus prefix indicating an “add to” action. */
export function SelectionActionPlus(props: SelectionActionPlusProps): ReactElement {
  return (
    <Plus
      strokeWidth={2.75}
      className={["selection-action-plus", props.className].filter(Boolean).join(" ")}
      aria-hidden
    />
  );
}
