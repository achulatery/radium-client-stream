export type Theme = {
  id: string;
  name: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  searchBar: string;
  searchBarText: string;
  button: string;
  buttonText: string;
  preset?: boolean;
};

export const PRESET_THEMES: Theme[] = [
  {
    id: "google-white",
    name: "Google White",
    background: "#ffffff",
    surface: "#f1f3f4",
    text: "#202124",
    muted: "#5f6368",
    accent: "#1a73e8",
    searchBar: "#ffffff",
    searchBarText: "#202124",
    button: "#f8f9fa",
    buttonText: "#3c4043",
    preset: true,
  },
  {
    id: "midnight-dark",
    name: "Midnight Dark",
    background: "#0f1115",
    surface: "#1b1f27",
    text: "#e8eaed",
    muted: "#9aa0a6",
    accent: "#8ab4f8",
    searchBar: "#1e222a",
    searchBarText: "#e8eaed",
    button: "#252a33",
    buttonText: "#e8eaed",
    preset: true,
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    background: "#0b2545",
    surface: "#13315c",
    text: "#eef4ff",
    muted: "#9dbbe0",
    accent: "#4cc9f0",
    searchBar: "#134074",
    searchBarText: "#eef4ff",
    button: "#1b4b8f",
    buttonText: "#eef4ff",
    preset: true,
  },
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon",
    background: "#0d0221",
    surface: "#1a0b35",
    text: "#f7f0ff",
    muted: "#b18cff",
    accent: "#ff2bd1",
    searchBar: "#20093f",
    searchBarText: "#f7f0ff",
    button: "#2b0d54",
    buttonText: "#00f5d4",
    preset: true,
  },
  {
    id: "forest-green",
    name: "Forest Green",
    background: "#0f1f16",
    surface: "#173026",
    text: "#e6f4ea",
    muted: "#a3c9ae",
    accent: "#57cc99",
    searchBar: "#1c3a2c",
    searchBarText: "#e6f4ea",
    button: "#234836",
    buttonText: "#e6f4ea",
    preset: true,
  },
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    background: "#2b1208",
    surface: "#40200f",
    text: "#fff3e6",
    muted: "#f0b98d",
    accent: "#ff7b29",
    searchBar: "#4a2513",
    searchBarText: "#fff3e6",
    button: "#5c2e18",
    buttonText: "#fff3e6",
    preset: true,
  },
];

export const THEME_FIELDS: { key: keyof Theme; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Panels" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Secondary text" },
  { key: "accent", label: "Accent" },
  { key: "searchBar", label: "Search bar" },
  { key: "searchBarText", label: "Search bar text" },
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
    "--rd-search": t.searchBar,
    "--rd-search-text": t.searchBarText,
    "--rd-button": t.button,
    "--rd-button-text": t.buttonText,
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
