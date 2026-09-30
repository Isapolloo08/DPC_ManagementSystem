import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';
const STORAGE_KEY = 'dpc_theme_mode';

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Appearance still works if storage is unavailable. */ }
  return 'auto';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  const hour = new Date().getHours();
  return mode === 'auto' ? (hour >= 6 && hour < 18 ? 'light' : 'dark') : mode;
}

const ThemeContext = createContext<{
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
} | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>(readMode);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(mode));

  useLayoutEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(mode);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = mode;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#2C3968');
      setResolvedTheme(resolved);
    };
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      apply();
      if (mode !== 'auto') return;
      const now = new Date();
      const next = new Date(now);
      if (now.getHours() < 6) next.setHours(6, 0, 0, 0);
      else if (now.getHours() < 18) next.setHours(18, 0, 0, 0);
      else { next.setDate(next.getDate() + 1); next.setHours(6, 0, 0, 0); }
      // Also recheck the local clock regularly for time-zone/clock changes.
      timer = window.setTimeout(refresh, Math.min(next.getTime() - now.getTime(), 60_000));
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [mode]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) updateMode(readMode());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const setMode = (next: ThemeMode) => {
    updateMode(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the in-memory choice. */ }
  };

  return <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
