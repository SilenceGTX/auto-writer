/** Right auxiliary panel for contextual writing assistance. */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button, Divider, Textarea } from "@heroui/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useAssistant } from "../context/AssistantContext";
import { useApp } from "../context/AppContext";
import { useToast } from "./Toast";
import { createInspiration } from "../api";
import { INSPIRATION_CREATED_EVENT } from "../utils/events";

interface AssistantPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Render the collapsible assistant panel.
 *
 * Always renders a portal slot that pages render their contextual content into.
 * The default quick-capture content is shown only when no page owns the panel.
 */
export function AssistantPanel(props: AssistantPanelProps): ReactElement {
  const { t } = useTranslation(["common", "outline"]);
  const { setSlot, pageOwnsPanel } = useAssistant();
  const { currentWorkId } = useApp();
  const { notify } = useToast();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveDraft(): Promise<void> {
    const content = draft.trim();
    if (!content) {
      return;
    }
    setSaving(true);
    try {
      await createInspiration({ content, work_id: currentWorkId ?? undefined });
      setDraft("");
      notify(t("outline:selectionActions.addInspiration.saved"), "success");
      window.dispatchEvent(new CustomEvent(INSPIRATION_CREATED_EVENT));
    } catch {
      notify(t("outline:selectionActions.addInspiration.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (props.collapsed) {
    return (
      <aside className="assistant-panel collapsed">
        <Button
          isIconOnly
          variant="light"
          aria-label={t("common:assistant.expand")}
          onPress={props.onToggle}
        >
          <PanelRightOpen size={20} />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div>
          <strong>{t("common:assistant.title")}</strong>
          <span>{t("common:assistant.subtitle")}</span>
        </div>
        <Button
          isIconOnly
          variant="light"
          aria-label={t("common:assistant.collapse")}
          onPress={props.onToggle}
        >
          <PanelRightClose size={20} />
        </Button>
      </div>

      <Divider />

      <div ref={setSlot} className="assistant-slot" />

      {!pageOwnsPanel && (
        <section className="assistant-section">
          <h2>{t("common:assistant.inspirationDraftTitle")}</h2>
          <Textarea
            minRows={8}
            placeholder={t("common:assistant.inspirationDraftPlaceholder")}
            value={draft}
            onValueChange={setDraft}
          />
          <Button
            color="primary"
            variant="flat"
            fullWidth
            isDisabled={!draft.trim()}
            isLoading={saving}
            onPress={() => void saveDraft()}
          >
            {t("common:assistant.saveToInspiration")}
          </Button>
        </section>
      )}
    </aside>
  );
}
