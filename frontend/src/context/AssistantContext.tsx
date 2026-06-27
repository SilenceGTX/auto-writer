/** Context that lets the active page render content into the right assistant panel.
 *
 * The persistent three-pane layout owns the assistant panel, but each page needs
 * to drive its contextual content there (work detail, AI actions, etc.). The
 * panel exposes a DOM "slot" through this context; pages render their assistant
 * UI into that slot via a React portal, keeping full access to their own state.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

interface AssistantContextValue {
  slot: HTMLDivElement | null;
  setSlot: (element: HTMLDivElement | null) => void;
  pageOwnsPanel: boolean;
  setPageOwnsPanel: (owns: boolean) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Provide the assistant-panel slot and ownership flag to the app tree. */
export function AssistantProvider(props: { children: ReactNode }): ReactElement {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [pageOwnsPanel, setPageOwnsPanel] = useState(false);

  const value = useMemo<AssistantContextValue>(
    () => ({ slot, setSlot, pageOwnsPanel, setPageOwnsPanel }),
    [slot, pageOwnsPanel],
  );

  return <AssistantContext.Provider value={value}>{props.children}</AssistantContext.Provider>;
}

/** Access the assistant-panel context; throws if used outside the provider. */
export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext);
  if (context === null) {
    throw new Error("useAssistant must be used within an AssistantProvider");
  }
  return context;
}
