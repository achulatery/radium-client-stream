import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useRadium } from "@/lib/radium";
import { PRESET_THEMES, THEME_FIELDS, type Theme } from "@/lib/themes";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Themes — Radium Client" },
      {
        name: "description",
        content:
          "Build unlimited custom themes, switch layout modes, toggle stealth mode and Singapore time in Radium Client.",
      },
      { property: "og:title", content: "Settings & Themes — Radium Client" },
      { property: "og:description", content: "Customize colors, layout and proxy behaviour." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const {
    theme,
    setTheme,
    customThemes,
    saveTheme,
    deleteTheme,
    settings,
    updateSettings,
    history,
    clearHistory,
  } = useRadium();
  const [draftName, setDraftName] = useState("My theme");

  const update = (key: keyof Theme, value: string) => {
    setTheme({ ...theme, [key]: value, preset: false, name: theme.preset ? "Custom" : theme.name });
  };

  const card = "rounded-xl p-5";
  const cardStyle = { background: "var(--rd-surface)" };

  return (
    <div
      className="min-h-screen px-5 py-8"
      style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <Link to="/" className="text-sm" style={{ color: "var(--rd-accent)" }}>
            Back home
          </Link>
        </div>

        <section className={card} style={cardStyle}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Preset themes</h2>
          <div className="flex flex-wrap gap-2">
            {PRESET_THEMES.map((p) => (
              <button
                key={p.id}
                onClick={() => setTheme(p)}
                className="rounded-full px-3 py-1.5 text-xs"
                style={{
                  background: p.button,
                  color: p.buttonText,
                  outline: theme.id === p.id ? `2px solid ${p.accent}` : "none",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <section className={card} style={cardStyle}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Colors (live preview)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEME_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{f.label}</span>
                <input
                  type="color"
                  value={String(theme[f.key] ?? "#000000")}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: "var(--rd-search)", color: "var(--rd-search-text)" }}
              placeholder="Theme name"
            />
            <button
              onClick={() => {
                const saved: Theme = {
                  ...theme,
                  id: `custom-${Date.now()}`,
                  name: draftName || "My theme",
                  preset: false,
                };
                saveTheme(saved);
                setTheme(saved);
              }}
              className="rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              Save theme
            </button>
          </div>
        </section>

        {customThemes.length > 0 && (
          <section className={card} style={cardStyle}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Saved themes</h2>
            <div className="space-y-2">
              {customThemes.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <button onClick={() => setTheme(t)} className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ background: t.accent, border: `1px solid ${t.text}` }}
                    />
                    {t.name}
                  </button>
                  <button
                    onClick={() => deleteTheme(t.id)}
                    className="text-xs"
                    style={{ color: "var(--rd-muted)" }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={card} style={cardStyle}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Browsing</h2>
          {[
            {
              key: "toolbarMode" as const,
              label: "Toolbar mode",
              hint: "Show the address bar immediately instead of the search homepage.",
            },
            {
              key: "stealth" as const,
              label: "Stealth mode",
              hint: "Rotate the browser identity sent to sites on every request.",
            },
            {
              key: "singaporeClock" as const,
              label: "Singapore time",
              hint: "Display SGT clock next to the ping counter.",
            },
          ].map((row) => (
            <label key={row.key} className="mb-3 flex items-start justify-between gap-4 text-sm">
              <span>
                {row.label}
                <span className="block text-xs" style={{ color: "var(--rd-muted)" }}>
                  {row.hint}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings[row.key]}
                onChange={(e) => updateSettings({ [row.key]: e.target.checked })}
                className="mt-1 h-4 w-4"
                style={{ accentColor: "var(--rd-accent)" }}
              />
            </label>
          ))}
        </section>

        <section className={card} style={cardStyle}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              History ({history.length})
            </h2>
            <button onClick={clearHistory} className="text-xs" style={{ color: "var(--rd-accent)" }}>
              Clear
            </button>
          </div>
          <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--rd-muted)" }}>
            {history.slice(0, 15).map((h) => (
              <div key={h.url} className="truncate">
                {h.url}
              </div>
            ))}
          </div>
        </section>

        <p className="pb-6 text-center text-xs" style={{ color: "var(--rd-muted)" }}>
          Radium Client — branding by James Xie
        </p>
      </div>
    </div>
  );
}
