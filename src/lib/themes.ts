export type Theme = {
  id: string;
  name: string;
  mode: "dark" | "light";
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentAlt: string;
  searchBar: string;
  searchBarText: string;
  button: string;
  buttonText: string;
  preset?: boolean;
};

export const RADIUM_DARK: Theme = {
  id: "radium-dark",
  name: "Radium Dark",
  mode: "dark",
  background: "#070807",
  surface: "#111311",
  text: "#f2f5f0",
  muted: "#8b938a",
  accent: "#19d3d1",
  accentAlt: "#19d3d1",
  searchBar: "#171a17",
  searchBarText: "#f2f5f0",
  button: "#191c19",
  buttonText: "#e6ebe3",
  preset: true,
};

export const RADIUM_LIGHT: Theme = {
  id: "radium-light",
  name: "Radium Light",
  mode: "light",
  background: "#f7f8f5",
  surface: "#ffffff",
  text: "#14170f",
  muted: "#61685c",
  accent: "#19d3d1",
  accentAlt: "#19d3d1",
  searchBar: "#ffffff",
  searchBarText: "#14170f",
  button: "#eceee7",
  buttonText: "#1e221a",
  preset: true,
};

export const PRESET_THEMES: Theme[] = [
  RADIUM_DARK,
  RADIUM_LIGHT,
  {
    id: "google-white",
    name: "Google White",
    mode: "light",
    background: "#ffffff",
    surface: "#f1f3f4",
    text: "#202124",
    muted: "#5f6368",
    accent: "#1a73e8",
    accentAlt: "#34a853",
    searchBar: "#ffffff",
    searchBarText: "#202124",
    button: "#f8f9fa",
    buttonText: "#3c4043",
    preset: true,
  },
  {
    id: "midnight-dark",
    name: "Midnight Dark",
    mode: "dark",
    background: "#0f1115",
    surface: "#1b1f27",
    text: "#e8eaed",
    muted: "#9aa0a6",
    accent: "#8ab4f8",
    accentAlt: "#c58af9",
    searchBar: "#1e222a",
    searchBarText: "#e8eaed",
    button: "#252a33",
    buttonText: "#e8eaed",
    preset: true,
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    mode: "dark",
    background: "#0b2545",
    surface: "#13315c",
    text: "#eef4ff",
    muted: "#9dbbe0",
    accent: "#4cc9f0",
    accentAlt: "#80ffdb",
    searchBar: "#134074",
    searchBarText: "#eef4ff",
    button: "#1b4b8f",
    buttonText: "#eef4ff",
    preset: true,
  },
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon",
    mode: "dark",
    background: "#0d0221",
    surface: "#1a0b35",
    text: "#f7f0ff",
    muted: "#b18cff",
    accent: "#ff2bd1",
    accentAlt: "#00f5d4",
    searchBar: "#20093f",
    searchBarText: "#f7f0ff",
    button: "#2b0d54",
    buttonText: "#00f5d4",
    preset: true,
  },
  {
    id: "forest-green",
    name: "Forest Green",
    mode: "dark",
    background: "#0f1f16",
    surface: "#173026",
    text: "#e6f4ea",
    muted: "#a3c9ae",
    accent: "#57cc99",
    accentAlt: "#c7f9cc",
    searchBar: "#1c3a2c",
    searchBarText: "#e6f4ea",
    button: "#234836",
    buttonText: "#e6f4ea",
    preset: true,
  },
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    mode: "light",
    background: "#fff5ec",
    surface: "#ffe6d3",
    text: "#3a1a09",
    muted: "#8a5537",
    accent: "#ff7b29",
    accentAlt: "#e5383b",
    searchBar: "#ffffff",
    searchBarText: "#3a1a09",
    button: "#ffd8ba",
    buttonText: "#3a1a09",
    preset: true,
  },
];

export const THEME_FIELDS: { key: keyof Theme; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Panels" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Secondary text" },
  { key: "accent", label: "Accent" },
  { key: "accentAlt", label: "Secondary accent" },
  { key: "searchBar", label: "Address bar" },
  { key: "searchBarText", label: "Address bar text" },
  { key: "button", label: "Buttons" },
  { key: "buttonText", label: "Button text" },
];

export const STORAGE_KEYS = {
  custom: "radium.customThemes",
  active: "radium.activeTheme",
  history: "radium.history",
  settings: "radium.settings",
};

export function themeToCss(t: Theme) {
  return {
    "--rd-bg": t.background,
    "--rd-surface": t.surface,
    "--rd-text": t.text,
    "--rd-muted": t.muted,
    "--rd-accent": t.accent,
    "--rd-accent-alt": t.accentAlt,
    "--rd-search": t.searchBar,
    "--rd-search-text": t.searchBarText,
    "--rd-button": t.button,
    "--rd-button-text": t.buttonText,
    "--rd-line": t.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)",
  } as Record<string, string>;
}

export function loadCustomThemes(): Theme[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.custom) ?? "[]") as Theme[];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: Theme[]) {
  localStorage.setItem(STORAGE_KEYS.custom, JSON.stringify(themes));
}
