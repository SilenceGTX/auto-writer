/** Left navigation sidebar for the Auto-Writer workspace. */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
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
import { SidebarLanguageMenu } from "./SidebarLanguageMenu";

interface NavItem {
  to: string;
  labelKey: "works" | "worldbuilding" | "outline" | "writing" | "inspiration" | "review";
  icon: ReactElement;
}

const navItems: NavItem[] = [
  { to: "/works", labelKey: "works", icon: <BookOpen size={18} /> },
  { to: "/worldbuilding", labelKey: "worldbuilding", icon: <Sparkles size={18} /> },
  { to: "/outline", labelKey: "outline", icon: <FileText size={18} /> },
  { to: "/writing", labelKey: "writing", icon: <PenLine size={18} /> },
  { to: "/inspiration", labelKey: "inspiration", icon: <Lightbulb size={18} /> },
  { to: "/review", labelKey: "review", icon: <SearchCheck size={18} /> },
];

/** Render the persistent left navigation and footer controls. */
export function Sidebar(): ReactElement {
  const { t } = useTranslation(["nav", "common"]);
  const { isDark, toggleTheme } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="app-sidebar">
      <div className="brand-block">
        <img className="brand-mark" src="/icon.png" alt={t("common:appName")} />
        <div>
          <strong>{t("common:appName")}</strong>
          <span>{t("common:appTagline")}</span>
        </div>
      </div>

      <nav className="nav-list" aria-label={t("nav:main")}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            {item.icon}
            <span>{t(`nav:${item.labelKey}`)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <SidebarLanguageMenu />
        <button className="nav-item" type="button" onClick={toggleTheme}>
          <SunMoon size={18} />
          <span>{isDark ? t("nav:themeLight") : t("nav:themeDark")}</span>
        </button>
        <button className="nav-item" type="button" onClick={() => setSettingsOpen(true)}>
          <Settings size={18} />
          <span>{t("nav:settings")}</span>
        </button>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
