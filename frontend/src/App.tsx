/** Root application component for the Auto-Writer frontend workspace. */
import { useMemo, useState, type ReactElement } from "react";
import { HeroUIProvider } from "@heroui/react";
import { AssistantPanel } from "./components/AssistantPanel";
import { Sidebar, type PageKey } from "./components/Sidebar";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { StoriesPage } from "./pages/StoriesPage";

const pageContent: Record<Exclude<PageKey, "stories">, { title: string; summary: string; steps: string[] }> = {
  world: {
    title: "设定",
    summary: "维护角色、地点、物品和概念，并在写作时引用它们。",
    steps: ["角色", "地点", "物品", "概念", "@ 引用"],
  },
  outline: {
    title: "大纲",
    summary: "从总纲到章节安排，再推进到可选的场景级细纲。",
    steps: ["总纲", "章节", "场景", "AI 生成", "人工调整"],
  },
  write: {
    title: "写作",
    summary: "围绕章节草稿、局部重写和上下文摘要组织正文创作。",
    steps: ["章节编辑", "局部重写", "前情提要", "人物近况"],
  },
  inspiration: {
    title: "灵感",
    summary: "与 AI 讨论点子，并沉淀可复用的灵感碎片。",
    steps: ["对话", "碎片保存", "转为设定", "转为大纲"],
  },
  review: {
    title: "审阅",
    summary: "通读全文，定位前后矛盾、硬伤和可优化段落。",
    steps: ["全文检查", "矛盾定位", "局部修订", "返回写作"],
  },
};

/** Render the selected central workspace page. */
function renderPage(page: PageKey): ReactElement {
  if (page === "stories") {
    return <StoriesPage />;
  }

  const content = pageContent[page];
  return <PlaceholderPage title={content.title} summary={content.summary} steps={content.steps} />;
}

/** Render the app shell with navigation, workspace, and assistant panel. */
function App(): ReactElement {
  const [activePage, setActivePage] = useState<PageKey>("stories");
  const [isDark, setIsDark] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);

  const themeClass = useMemo(() => (isDark ? "dark" : "light"), [isDark]);

  return (
    <HeroUIProvider>
      <div className={`app-root ${themeClass}`}>
        <Sidebar
          activePage={activePage}
          isDark={isDark}
          onNavigate={setActivePage}
          onToggleTheme={() => setIsDark((current) => !current)}
        />
        <main className="workspace-main">{renderPage(activePage)}</main>
        <AssistantPanel
          collapsed={assistantCollapsed}
          onToggle={() => setAssistantCollapsed((current) => !current)}
        />
      </div>
    </HeroUIProvider>
  );
}

export default App;
