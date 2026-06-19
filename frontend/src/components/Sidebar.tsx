/** Left sidebar navigation component. */
import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const topItems: NavItem[] = [
  { to: "/stories", label: "作品", icon: "📖" },
  { to: "/outline", label: "大纲", icon: "🗺️" },
  { to: "/write", label: "写作", icon: "✍️" },
  { to: "/worldbuilding", label: "设定", icon: "🌍" },
  { to: "/inspiration", label: "灵感", icon: "💡" },
  { to: "/review", label: "审阅", icon: "🔍" },
];

const bottomItems: NavItem[] = [
  { to: "/settings", label: "系统设置", icon: "⚙️" },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Auto-Writer</div>
      <nav className="sidebar-nav">
        <ul className="sidebar-nav-top">
          {topItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  "sidebar-link" + (isActive ? " active" : "")
                }
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <ul className="sidebar-nav-bottom">
          {bottomItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  "sidebar-link" + (isActive ? " active" : "")
                }
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
