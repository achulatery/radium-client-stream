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
  RADIUM_DARK,
  RADIUM_LIGHT,
  STORAGE_KEYS,
  loadCustomThemes,
  saveCustomThemes,
  themeToCss,
  type Theme,
} from "./themes";

export type Settings = {
  stealth: boolean;
  singaporeClock: boolean;
  transport: "edge";
  wispServer: string;
  homePage: string;
  httpCache: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  stealth: false,
  singaporeClock: true,
  transport: "edge",
  wispServer: "wss://wisp.mercurywork.shop/",
  homePage: "https://google.com",
  httpCache: true,
};

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleMode: () => void;
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
  const [theme, setThemeState] = useState<Theme>(RADIUM_DARK);
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
    document.documentElement.classList.toggle("dark", theme.mode === "dark");
    document.documentElement.style.colorScheme = theme.mode;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(t));
  }, []);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => {
      const base = prev.mode === "dark" ? RADIUM_LIGHT : RADIUM_DARK;
      const next = { ...base, accent: prev.accent, accentAlt: prev.accentAlt };
      localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(next));
      return next;
    });
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
      toggleMode,
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
      toggleMode,
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
  return searchUrl(q);
}

/** Proxy-friendly search endpoints that don't trigger bot walls on datacenter IPs. */
export function searchUrl(query: string) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

/** Extract a YouTube video id from any common YouTube URL shape. */
export function getYouTubeVideoId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  const ok = (id: string | null | undefined) =>
    id && /^[\w-]{6,20}$/.test(id) ? id : null;
  if (host === "youtu.be") return ok(u.pathname.split("/").filter(Boolean)[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return ok(u.searchParams.get("v"));
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") return ok(parts[1]);
  }
  return null;
}

/**
 * Watch pages trip YouTube's bot wall; the embed endpoint is far less
 * restricted, so every video resolves to an embed player URL instead.
 */
export function videoPlayerUrl(videoId: string) {
  const id = encodeURIComponent(videoId);
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&hl=en&gl=SG&vq=tiny&playsinline=1`;
}
