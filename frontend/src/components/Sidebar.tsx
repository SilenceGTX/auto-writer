/** Left sidebar navigation component — NextUI themed. */
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
    <aside
      className="
        flex flex-col w-[200px] min-w-[200px] h-full
        bg-zinc-900 text-zinc-300 overflow-y-auto
        border-r border-zinc-700
      "
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-3 text-base font-bold tracking-wide text-white border-b border-white/10">
        Auto-Writer
      </div>

      {/* Top nav */}
      <nav className="flex flex-col flex-1 py-3">
        <ul className="flex flex-col gap-0.5 px-2">
          {topItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors" +
                  (isActive
                    ? " bg-blue-600 text-white font-medium"
                    : " text-zinc-400 hover:text-white hover:bg-white/5")
                }
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Bottom nav — pushed to bottom */}
        <ul className="flex flex-col gap-0.5 px-2 mt-auto mb-2">
          {bottomItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors" +
                  (isActive
                    ? " bg-blue-600 text-white font-medium"
                    : " text-zinc-400 hover:text-white hover:bg-white/5")
                }
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
