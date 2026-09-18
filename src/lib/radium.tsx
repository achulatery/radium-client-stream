import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PRESET_THEMES,
  STORAGE_KEYS,
  loadCustomThemes,
  saveCustomThemes,
  themeToCss,
  type Theme,
} from "./themes";

export type Settings = {
  toolbarMode: boolean;
  stealth: boolean;
  singaporeClock: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  toolbarMode: false,
  stealth: false,
  singaporeClock: true,
};

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  customThemes: Theme[];
  saveTheme: (t: Theme) => void;
  deleteTheme: (id: string) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  history: { url: string; at: number }[];
  pushHistory: (url: string) => void;
  clearHistory: () => void;
};

const RadiumContext = createContext<Ctx | null>(null);

export function RadiumProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(PRESET_THEMES[0]!);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<{ url: string; at: number }[]>([]);

  useEffect(() => {
    setCustomThemes(loadCustomThemes());
    try {
      const active = localStorage.getItem(STORAGE_KEYS.active);
      if (active) setThemeState(JSON.parse(active) as Theme);
      const s = localStorage.getItem(STORAGE_KEYS.settings);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Settings) });
      const h = localStorage.getItem(STORAGE_KEYS.history);
      if (h) setHistory(JSON.parse(h) as { url: string; at: number }[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    const vars = themeToCss(theme);
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(t));
  }, []);

  const saveTheme = useCallback((t: Theme) => {
    setCustomThemes((prev) => {
      const next = [...prev.filter((x) => x.id !== t.id), t];
      saveCustomThemes(next);
      return next;
    });
  }, []);

  const deleteTheme = useCallback((id: string) => {
    setCustomThemes((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveCustomThemes(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
      return next;
    });
  }, []);

  const pushHistory = useCallback((url: string) => {
    setHistory((prev) => {
      const next = [{ url, at: Date.now() }, ...prev.filter((h) => h.url !== url)].slice(0, 30);
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEYS.history);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      customThemes,
      saveTheme,
      deleteTheme,
      settings,
      updateSettings,
      history,
      pushHistory,
      clearHistory,
    }),
    [
      theme,
      setTheme,
      customThemes,
      saveTheme,
      deleteTheme,
      settings,
      updateSettings,
      history,
      pushHistory,
      clearHistory,
    ],
  );

  return <RadiumContext.Provider value={value}>{children}</RadiumContext.Provider>;
}

export function useRadium() {
  const ctx = useContext(RadiumContext);
  if (!ctx) throw new Error("useRadium must be used inside RadiumProvider");
  return ctx;
}

export function proxyUrl(target: string, stealth = false) {
  return `/api/public/p?u=${encodeURIComponent(target)}${stealth ? "&stealth=1" : ""}`;
}

export function normalizeQuery(input: string) {
  const q = input.trim();
  if (!q) return null;
  const looksLikeUrl = /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+(\/|$|:\d)/.test(q);
  if (looksLikeUrl) return /^https?:\/\//i.test(q) ? q : `https://${q}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}
