/** Root application component: routed three-pane workspace shell. */
import { useEffect, type ReactElement } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getSettings } from "./api";
import { AssistantPanel } from "./components/AssistantPanel";
import { Sidebar } from "./components/Sidebar";
import { useApp } from "./context/AppContext";
import { useAssistant } from "./context/AssistantContext";
import { ConceptPage } from "./pages/ConceptPage";
import { InspirationPage } from "./pages/InspirationPage";
import { OutlinePage } from "./pages/OutlinePage";
import { ReviewPage } from "./pages/ReviewPage";
import { WorksPage } from "./pages/WorksPage";
import { WritingPage } from "./pages/WritingPage";
import { applyTypography } from "./utils/typography";

/** Render the persistent three-pane layout with a routed central workspace. */
function Layout(): ReactElement {
  const { isDark } = useApp();
  const { collapsed, setCollapsed, focusMode } = useAssistant();

  useEffect(() => {
    void getSettings()
      .then((settings) => applyTypography(settings.typography))
      .catch(() => undefined);
  }, []);

  // Mirror the theme onto <html> so HeroUI's portaled overlays (dropdowns,
  // menus, modals) also pick up the dark palette instead of rendering light.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div
      className={[
        "app-root",
        isDark ? "dark" : "light",
        collapsed ? "assistant-collapsed" : "",
        focusMode ? "focus-mode" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
        <Route path="/writing" element={<WritingPage />} />
        <Route path="/inspiration" element={<InspirationPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/works" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
