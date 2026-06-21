/** Right auxiliary panel for contextual writing assistance. */
import type { ReactElement } from "react";
import { Button, Divider, Textarea } from "@heroui/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface AssistantPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Render collapsible assistant notes and quick action controls. */
export function AssistantPanel(props: AssistantPanelProps): ReactElement {
  if (props.collapsed) {
    return (
      <aside className="assistant-panel collapsed">
        <Button isIconOnly variant="light" aria-label="展开辅助区" onPress={props.onToggle}>
          <PanelRightOpen size={20} />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div>
          <strong>辅助区</strong>
          <span>当前上下文与 AI 操作</span>
        </div>
        <Button isIconOnly variant="light" aria-label="折叠辅助区" onPress={props.onToggle}>
          <PanelRightClose size={20} />
        </Button>
      </div>

      <Divider />

      <section className="assistant-section">
        <h2>快速操作</h2>
        <Button color="primary" variant="flat" fullWidth>
          生成大纲建议
        </Button>
        <Button color="secondary" variant="flat" fullWidth>
          梳理角色近况
        </Button>
      </section>

      <section className="assistant-section">
        <h2>灵感暂存</h2>
        <Textarea minRows={8} placeholder="记录一句对白、一个转折或一个设定碎片..." />
      </section>
    </aside>
  );
}
