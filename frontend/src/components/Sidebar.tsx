/** Left navigation sidebar for the Auto-Writer workspace. */
import { useState, type ReactElement } from "react";
import { NavLink } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Lightbulb,
  PenLine,
  SearchCheck,
  Settings,
  Sparkles,
  SunMoon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { SettingsModal } from "./SettingsModal";

interface NavItem {
  to: string;
  label: string;
  icon: ReactElement;
}

const navItems: NavItem[] = [
  { to: "/works", label: "作品", icon: <BookOpen size={18} /> },
  { to: "/worldbuilding", label: "设定", icon: <Sparkles size={18} /> },
  { to: "/outline", label: "大纲", icon: <FileText size={18} /> },
  { to: "/writing", label: "写作", icon: <PenLine size={18} /> },
  { to: "/inspiration", label: "灵感", icon: <Lightbulb size={18} /> },
  { to: "/review", label: "审阅", icon: <SearchCheck size={18} /> },
];

/** Render the persistent left navigation and footer controls. */
export function Sidebar(): ReactElement {
  const { isDark, toggleTheme } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="app-sidebar">
      <div className="brand-block">
        <div className="brand-mark">AW</div>
        <div>
          <strong>Auto-Writer</strong>
          <span>小说创作工作台</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="主导航">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" type="button" onClick={toggleTheme}>
          <SunMoon size={18} />
          <span>{isDark ? "浅色主题" : "深色主题"}</span>
        </button>
        <button className="nav-item" type="button" onClick={() => setSettingsOpen(true)}>
          <Settings size={18} />
          <span>系统设置</span>
        </button>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
