/** Root application component: routed three-pane workspace shell. */
import type { ReactElement } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AssistantPanel } from "./components/AssistantPanel";
import { Sidebar } from "./components/Sidebar";
import { useApp } from "./context/AppContext";
import { useAssistant } from "./context/AssistantContext";
import { ConceptPage } from "./pages/ConceptPage";
import { OutlinePage } from "./pages/OutlinePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { WorksPage } from "./pages/WorksPage";

const placeholderPages: Record<string, { title: string; summary: string; steps: string[] }> = {
  writing: {
    title: "写作",
    summary: "围绕章节草稿、局部重写和上下文摘要组织正文创作。",
    steps: ["章节编辑", "局部重写", "前情提要", "专注模式"],
  },
  inspiration: {
    title: "灵感",
    summary: "保存与管理灵感碎片，并可回插到写作中。",
    steps: ["卡片", "标签", "搜索", "一键回插", "来源跳转"],
  },
  review: {
    title: "审阅",
    summary: "通读全文，定位前后矛盾、硬伤和可优化段落。",
    steps: ["阅读器", "目录跳转", "阅读进度", "AI 审阅"],
  },
};

/** Render the persistent three-pane layout with a routed central workspace. */
function Layout(): ReactElement {
  const { isDark } = useApp();
  const { collapsed, setCollapsed } = useAssistant();

  return (
    <div
      className={`app-root ${isDark ? "dark" : "light"} ${
        collapsed ? "assistant-collapsed" : ""
      }`}
    >
      <Sidebar />
      <main className="workspace-main">
        <Outlet />
      </main>
      <AssistantPanel collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
    </div>
  );
}

/** Define the application routes within the shared layout. */
function App(): ReactElement {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/works" replace />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/worldbuilding" element={<ConceptPage />} />
        <Route path="/outline" element={<OutlinePage />} />
        {Object.entries(placeholderPages).map(([path, content]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <PlaceholderPage title={content.title} summary={content.summary} steps={content.steps} />
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/works" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
