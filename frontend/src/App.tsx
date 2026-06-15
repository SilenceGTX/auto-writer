/** Root application component — left sidebar + right workspace layout. */
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import StoriesPage from "./pages/StoriesPage";
import WritePage from "./pages/WritePage";
import PlaceholderPage from "./pages/PlaceholderPage";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <main className="workspace">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/write" element={<WritePage />} />
            <Route path="/outline" element={<PlaceholderPage title="大纲" />} />
            <Route path="/characters" element={<PlaceholderPage title="角色" />} />
            <Route path="/worldbuilding" element={<PlaceholderPage title="设定" />} />
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
