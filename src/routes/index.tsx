import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PingCounter, RadiumMark, SingaporeClock } from "@/components/radium-ui";
import { normalizeQuery, proxyUrl, useRadium } from "@/lib/radium";
import { PRESET_THEMES, THEME_FIELDS, type Theme } from "@/lib/themes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radium Client — The web, uncontained" },
      {
        name: "description",
        content:
          "Radium Client is a themeable web proxy window with live latency, media streaming support and Singapore-first routing.",
      },
      { property: "og:title", content: "Radium Client — The web, uncontained" },
      {
        property: "og:description",
        content: "Browse, test and theme the web through Radium Client's encrypted transport.",
      },
    ],
  }),
  component: RadiumApp,
});

type Tab = "browser" | "playground" | "settings";

function RadiumApp() {
  const [tab, setTab] = useState<Tab>("browser");
  const { theme, toggleMode, settings } = useRadium();

  return (
    <div
      className="flex h-screen flex-col overflow-hidden font-sans"
      style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--rd-line)" }}
      >
        <div className="flex items-center gap-3">
          <RadiumMark />
          <span className="text-lg font-semibold tracking-[0.18em]">RADIUM</span>
          <span
            className="font-mono text-[11px] tracking-[0.3em]"
            style={{ color: "var(--rd-muted)" }}
          >
            CLIENT
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 font-mono text-[11px] tracking-[0.2em] sm:flex">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--rd-accent-alt)" }} />
            PROTECTED
          </span>
          {settings.singaporeClock && <SingaporeClock />}
          <PingCounter />
          <button
            onClick={toggleMode}
            aria-label="Toggle dark and light mode"
            className="flex h-8 w-8 items-center justify-center rounded-md text-sm"
            style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
          >
            {theme.mode === "dark" ? "☀" : "☾"}
          </button>
          <span
            className="hidden font-mono text-[11px] tracking-[0.2em] md:inline"
            style={{ color: "var(--rd-muted)" }}
          >
            BY JAMES XIE
          </span>
        </div>
      </header>

      <nav className="flex items-end gap-1 px-3" style={{ borderBottom: "1px solid var(--rd-line)" }}>
        {(
          [
            ["browser", "Browser"],
            ["playground", "Playground"],
            ["settings", "Settings"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-5 py-3 text-sm transition-colors"
            style={{
              color: tab === id ? "var(--rd-text)" : "var(--rd-muted)",
              background: tab === id ? "var(--rd-surface)" : "transparent",
              borderBottom: `2px solid ${tab === id ? "var(--rd-accent-alt)" : "transparent"}`,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        {tab === "browser" && <BrowserTab />}
        {tab === "playground" && <PlaygroundTab />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <footer
        className="flex items-center justify-between px-4 py-2 font-mono text-[11px] tracking-[0.2em]"
        style={{ borderTop: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--rd-accent-alt)" }} />
          RADIUM SESSION
        </span>
        <span>EDGE TRANSPORT · ENCRYPTED</span>
      </footer>
    </div>
  );
}

function BrowserTab() {
  const { settings, pushHistory, history } = useRadium();
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState("Transport ready");
  const frame = useRef<HTMLIFrameElement>(null);

  const open = useCallback(
    (raw: string) => {
      const url = normalizeQuery(raw);
      if (!url) return;
      setTarget(url);
      setInput(url);
      setStatus(`Loading ${url}`);
      setNonce((n) => n + 1);
      pushHistory(url);
    },
    [pushHistory],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { __radium?: string; url?: string };
      if (!data?.__radium || !data.url) return;
      if (data.__radium === "navigate") {
        try {
          const next = new URL(data.url);
          if (next.protocol !== "http:" && next.protocol !== "https:") return;
          setTarget(next.toString());
          setInput(next.toString());
          setStatus(`Loading ${next.toString()}`);
          setNonce((value) => value + 1);
          pushHistory(next.toString());
        } catch {
          return;
        }
      }
      if (data.__radium === "loaded") {
        setInput(data.url);
        setStatus("Transport ready");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pushHistory]);

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-md text-sm transition-opacity hover:opacity-75";
  const iconStyle = { background: "var(--rd-button)", color: "var(--rd-button-text)" };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          className={iconBtn}
          style={iconStyle}
          aria-label="Back"
          onClick={() => frame.current?.contentWindow?.history.back()}
        >
          ←
        </button>
        <button
          className={iconBtn}
          style={iconStyle}
          aria-label="Forward"
          onClick={() => frame.current?.contentWindow?.history.forward()}
        >
          →
        </button>
        <button
          className={iconBtn}
          style={iconStyle}
          aria-label="Reload"
          onClick={() => setNonce((n) => n + 1)}
        >
          ⟳
        </button>
        <button
          className={iconBtn}
          style={iconStyle}
          aria-label="Home"
          onClick={() => {
            setTarget(null);
            setInput("");
            setStatus("Transport ready");
          }}
        >
          ⌂
        </button>
        <form
          className="min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            open(input);
          }}
        >
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2"
            style={{ background: "var(--rd-search)", border: "1px solid var(--rd-line)" }}
          >
            <span className="text-xs" style={{ color: "var(--rd-accent-alt)" }}>
              🔒
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search or enter a web address"
              aria-label="Address bar"
              autoComplete="off"
              className="w-full bg-transparent font-mono text-sm outline-none"
              style={{ color: "var(--rd-search-text)" }}
            />
          </div>
        </form>
      </div>

      <div
        className="flex items-center justify-between px-4 py-1.5 font-mono text-[11px] tracking-[0.12em]"
        style={{ borderTop: "1px solid var(--rd-line)", borderBottom: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="truncate">{status}</span>
        <span style={{ color: "var(--rd-accent-alt)" }}>EDGE PROXY · ENCRYPTED</span>
      </div>

      <div className="relative min-h-0 flex-1">
        {target ? (
          <iframe
            key={nonce}
            ref={frame}
            title="Proxied content"
            src={proxyUrl(target, settings.stealth)}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-presentation"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          />
        ) : (
          <StartScreen open={open} history={history} />
        )}
      </div>
    </div>
  );
}

function StartScreen({
  open,
  history,
}: {
  open: (url: string) => void;
  history: { url: string; at: number }[];
}) {
  return (
    <div
      className="h-full overflow-auto px-4 py-10"
      style={{
        backgroundImage:
          "linear-gradient(var(--rd-line) 1px, transparent 1px), linear-gradient(90deg, var(--rd-line) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
      }}
    >
      <div className="relative mx-auto max-w-3xl">
        <div
          className="absolute inset-0 translate-x-3 translate-y-3 rounded-sm"
          style={{ border: "2px solid var(--rd-accent)" }}
          aria-hidden
        />
        <div
          className="relative px-6 py-14 text-center"
          style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}
        >
          <div className="mb-8 flex justify-center">
            <span
              className="flex h-24 w-24 items-center justify-center rounded-2xl text-5xl font-semibold"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              R
            </span>
          </div>
          <p
            className="font-mono text-xs tracking-[0.35em]"
            style={{ color: "var(--rd-muted)" }}
          >
            RADIUM CLIENT · READY
          </p>
          <h1 className="mx-auto mt-4 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            The web,
            <br />
            uncontained.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-sm" style={{ color: "var(--rd-muted)" }}>
            Enter an address above or launch a site through Radium's accelerated encrypted
            transport.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => open("https://duckduckgo.com/")}
              className="rounded-md px-8 py-3 text-sm"
              style={{ background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" }}
            >
              Search
            </button>
            <button
              onClick={() => open("https://github.com/")}
              className="rounded-md px-8 py-3 text-sm"
              style={{ background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" }}
            >
              GitHub
            </button>
          </div>
          {history.length > 0 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {history.slice(0, 6).map((h) => (
                <button
                  key={h.url}
                  onClick={() => open(h.url)}
                  className="max-w-full truncate rounded-full px-3 py-1.5 font-mono text-[11px]"
                  style={{ background: "var(--rd-button)", color: "var(--rd-muted)" }}
                >
                  {h.url.replace(/^https?:\/\//, "")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Probe = { url: string; status: number | string; ms: number; type: string };

function PlaygroundTab() {
  const { settings } = useRadium();
  const [url, setUrl] = useState("https://www.youtube.com/");
  const [probes, setProbes] = useState<Probe[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const target = normalizeQuery(url);
    if (!target) return;
    setBusy(true);
    const start = performance.now();
    try {
      const res = await fetch(proxyUrl(target, settings.stealth), { method: "GET" });
      setProbes((p) => [
        {
          url: target,
          status: res.status,
          ms: Math.round(performance.now() - start),
          type: res.headers.get("content-type")?.split(";")[0] ?? "unknown",
        },
        ...p,
      ]);
    } catch (error) {
      setProbes((p) => [
        {
          url: target,
          status: (error as Error).message,
          ms: Math.round(performance.now() - start),
          type: "error",
        },
        ...p,
      ]);
    }
    setBusy(false);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Compatibility playground</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--rd-muted)" }}>
            Check whether a site answers through the proxy, how fast, and what it returns.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded-md px-3 py-2 font-mono text-sm outline-none"
            style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }}
            aria-label="URL to test"
          />
          <button
            onClick={run}
            disabled={busy}
            className="rounded-md px-5 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
          >
            {busy ? "Testing…" : "Test"}
          </button>
        </div>
        <div className="space-y-2">
          {probes.map((p, i) => (
            <div
              key={`${p.url}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 font-mono text-xs"
              style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}
            >
              <span className="truncate" style={{ maxWidth: "60%" }}>
                {p.url}
              </span>
              <span
                style={{
                  color:
                    typeof p.status === "number" && p.status < 400
                      ? "var(--rd-accent-alt)"
                      : "#f85149",
                }}
              >
                {p.status} · {p.ms} ms · {p.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
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

  const update = (key: keyof Theme, value: string) =>
    setTheme({
      ...theme,
      [key]: value,
      preset: false,
      name: theme.preset ? "Custom" : theme.name,
    });

  const section = "border-b py-4 last:border-b-0";
  const sectionStyle = { borderColor: "var(--rd-line)" };

  return (
    <div className="h-full overflow-auto px-5 py-2">
      <div className="mx-auto max-w-2xl pb-8">
        <section className={section} style={sectionStyle}>
          <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
            MODE
          </h2>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(PRESET_THEMES.find((p) => p.mode === mode) ?? theme)}
                className="rounded-md px-4 py-2 text-sm capitalize"
                style={{
                  background: theme.mode === mode ? "var(--rd-accent)" : "var(--rd-button)",
                  color: theme.mode === mode ? "var(--rd-bg)" : "var(--rd-button-text)",
                }}
              >
                {mode} mode
              </button>
            ))}
          </div>
        </section>

        <section className={section} style={sectionStyle}>
          <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
            PRESETS
          </h2>
          <div className="flex flex-wrap gap-2">
            {PRESET_THEMES.map((p) => (
              <button
                key={p.id}
                onClick={() => setTheme(p)}
                className="rounded-md px-3 py-1.5 text-xs"
                style={{
                  background: p.button,
                  color: p.buttonText,
                  outline: theme.id === p.id ? `2px solid ${p.accent}` : "1px solid var(--rd-line)",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <section className={section} style={sectionStyle}>
          <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
            COLORS · LIVE PREVIEW
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
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }}
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
          <section className={section} style={sectionStyle}>
            <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
              SAVED THEMES
            </h2>
            <div className="space-y-2">
              {customThemes.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <button onClick={() => setTheme(t)} className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ background: t.accent, border: "1px solid var(--rd-line)" }}
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

        <section className={section} style={sectionStyle}>
          <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
            SESSION
          </h2>
          {[
            {
              key: "stealth" as const,
              label: "Stealth mode",
              hint: "Rotate the browser identity sent to sites on every request.",
            },
            {
              key: "singaporeClock" as const,
              label: "Singapore time",
              hint: "Show the SGT clock next to the latency counter.",
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

        <section className={section} style={sectionStyle}>
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
              HISTORY ({history.length})
            </h2>
            <button onClick={clearHistory} className="text-xs" style={{ color: "var(--rd-accent)" }}>
              Clear
            </button>
          </div>
          <div className="mt-3 space-y-1 font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>
            {history.slice(0, 15).map((h) => (
              <div key={h.url} className="truncate">
                {h.url}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
