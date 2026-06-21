/** Left navigation sidebar for the Auto-Writer workspace. */
import type { ReactElement } from "react";
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

export type PageKey = "stories" | "world" | "outline" | "write" | "inspiration" | "review";

interface SidebarProps {
  activePage: PageKey;
  isDark: boolean;
  onNavigate: (page: PageKey) => void;
  onToggleTheme: () => void;
}

const navItems: Array<{ key: PageKey; label: string; icon: ReactElement }> = [
  { key: "stories", label: "作品", icon: <BookOpen size={18} /> },
  { key: "world", label: "设定", icon: <Sparkles size={18} /> },
  { key: "outline", label: "大纲", icon: <FileText size={18} /> },
  { key: "write", label: "写作", icon: <PenLine size={18} /> },
  { key: "inspiration", label: "灵感", icon: <Lightbulb size={18} /> },
  { key: "review", label: "审阅", icon: <SearchCheck size={18} /> },
];

/** Render the persistent left navigation and footer controls. */
export function Sidebar(props: SidebarProps): ReactElement {
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
          <button
            key={item.key}
            className={props.activePage === item.key ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => props.onNavigate(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" type="button" onClick={props.onToggleTheme}>
          <SunMoon size={18} />
          <span>{props.isDark ? "浅色主题" : "深色主题"}</span>
        </button>
        <button className="nav-item" type="button">
          <Settings size={18} />
          <span>系统设置</span>
        </button>
      </div>
    </aside>
  );
}
