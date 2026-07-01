/** Global application context: theme and current-work selection, persisted to localStorage. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const THEME_KEY = "aw.theme";
const CURRENT_WORK_KEY = "aw.currentWorkId";

interface AppContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  currentWorkId: number | null;
  setCurrentWorkId: (workId: number | null) => void;
  /** Text queued for "一键回插" insertion into the writing editor (G3 闭环). */
  pendingInsert: string | null;
  setPendingInsert: (text: string | null) => void;
  /** Text to highlight on the target page after a "来源跳转" jump, if still present. */
  pendingHighlight: string | null;
  setPendingHighlight: (text: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Read the persisted theme preference, defaulting to light. */
function readInitialTheme(): boolean {
  return localStorage.getItem(THEME_KEY) === "dark";
}

/** Read the persisted current-work id, if any. */
function readInitialWorkId(): number | null {
  const raw = localStorage.getItem(CURRENT_WORK_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Provide global theme and current-work state to the application tree. */
export function AppProvider(props: { children: ReactNode }): ReactElement {
  const [isDark, setIsDark] = useState<boolean>(readInitialTheme);
  const [currentWorkId, setCurrentWorkIdState] = useState<number | null>(readInitialWorkId);
  const [pendingInsert, setPendingInsert] = useState<string | null>(null);
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    // Apply the theme class to <html> as well so HeroUI components rendered in
    // portals (modals, popovers) outside .app-root still pick up the theme.
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark((current) => !current), []);

  const setCurrentWorkId = useCallback((workId: number | null) => {
    setCurrentWorkIdState(workId);
    if (workId === null) {
      localStorage.removeItem(CURRENT_WORK_KEY);
    } else {
      localStorage.setItem(CURRENT_WORK_KEY, String(workId));
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      isDark,
      toggleTheme,
      currentWorkId,
      setCurrentWorkId,
      pendingInsert,
      setPendingInsert,
      pendingHighlight,
      setPendingHighlight,
    }),
    [isDark, toggleTheme, currentWorkId, setCurrentWorkId, pendingInsert, pendingHighlight],
  );

  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
}

/** Access the global application context; throws if used outside the provider. */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (context === null) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
