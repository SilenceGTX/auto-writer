/** Root application component — left sidebar + right workspace layout. */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import StoriesPage from "./pages/StoriesPage";
import OutlinePage from "./pages/OutlinePage";
import WorldBuildingPage from "./pages/WorldBuildingPage";
import PlaceholderPage from "./pages/PlaceholderPage";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <main className="workspace">
          <Routes>
            <Route path="/" element={<Navigate to="/stories" replace />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/write" element={<PlaceholderPage title="写作" />} />
            <Route path="/outline" element={<OutlinePage />} />
            <Route path="/worldbuilding" element={<WorldBuildingPage />} />
            <Route path="/inspiration" element={<PlaceholderPage title="灵感" />} />
            <Route path="/review" element={<PlaceholderPage title="审阅" />} />
            <Route path="/settings" element={<PlaceholderPage title="系统设置" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
