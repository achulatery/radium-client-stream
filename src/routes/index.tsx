import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Home,
  LockKeyhole,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Youtube,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PingCounter, RadiumMark, SingaporeClock } from "@/components/radium-ui";
import {
  formatDuration,
  formatViews,
  getComments,
  getTrending,
  getVideo,
  searchVideos,
  type InvidiousComment,
  type InvidiousVideo,
} from "@/lib/invidious";
import {
  getYouTubeVideoId,
  normalizeQuery,
  proxyUrl,
  searchUrl,
  useRadium,
  videoPlayerUrl,
} from "@/lib/radium";
import { pipedSearch, pipedStreams, pipedTrending, type PipedItem, type PipedVideo } from "@/lib/piped";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RadiumApp,
});

type Tab = "browser" | "youtube" | "settings";

function RadiumApp() {
  const [tab, setTab] = useState<Tab>("browser");
  const { theme, toggleMode, settings } = useRadium();

  return (
    <div
      className="radium-shell flex h-screen min-h-[520px] flex-col overflow-hidden font-sans"
      style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}
    >
      <header
        className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-5"
        style={{ borderBottom: "1px solid var(--rd-line)" }}
      >
        <div className="flex items-center gap-3">
          <RadiumMark />
          <span className="text-sm font-bold tracking-[0.22em]">RADIUM</span>
          <span
            className="font-mono text-[9px] tracking-[0.28em]"
            style={{ color: "var(--rd-muted)" }}
          >
            CLIENT
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 font-mono text-[9px] tracking-[0.18em] sm:flex">
            <span className="status-glow h-1.5 w-1.5 rounded-full" style={{ background: "var(--rd-accent-alt)" }} />
            PROTECTED
          </span>
          {settings.singaporeClock && <SingaporeClock />}
          <PingCounter />
          <button
            onClick={toggleMode}
            aria-label="Toggle dark and light mode"
            className="flex h-8 w-8 items-center justify-center rounded-sm"
            style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
          >
            <Sun size={14} />
          </button>
          <span
            className="hidden font-mono text-[11px] tracking-[0.2em] md:inline"
            style={{ color: "var(--rd-muted)" }}
          >
            BY JAMES XIE
          </span>
        </div>
      </header>

      <nav className="flex h-11 shrink-0 items-stretch gap-0 px-3" style={{ background: "var(--rd-surface)", borderBottom: "1px solid var(--rd-line)" }}>
        {(
          [
            ["browser", "Browser"],
            ["youtube", "YouTube"],
            ["settings", "Settings"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex min-w-24 items-center justify-center gap-2 border-x px-4 text-xs transition-colors"
            style={{
              color: tab === id ? "var(--rd-text)" : "var(--rd-muted)",
              background: tab === id ? "var(--rd-bg)" : "transparent",
              borderBottom: `2px solid ${tab === id ? "var(--rd-accent-alt)" : "transparent"}`,
              borderLeftColor: tab === id ? "var(--rd-line)" : "transparent",
              borderRightColor: tab === id ? "var(--rd-line)" : "transparent",
            }}
          >
            {id === "browser" ? <ShieldCheck size={13} /> : id === "youtube" ? <Youtube size={14} /> : <Settings size={13} />}
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        {tab === "browser" && <BrowserTab />}
        {tab === "youtube" && <YouTubeTab />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <footer
        className="flex items-center justify-between px-4 py-2 font-mono text-[11px] tracking-[0.2em]"
        style={{ borderTop: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="flex items-center gap-2">
          <ShieldCheck size={12} style={{ color: "var(--rd-accent-alt)" }} />
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
  const [status, setStatus] = useState("Transport ready");
  const [nonce, setNonce] = useState(0);

  const videoId = target ? getYouTubeVideoId(target) : null;
  const playerHref = videoId ? videoPlayerUrl(videoId) : null;
  const frameSrc = target ? proxyUrl(playerHref ?? target, settings.stealth) : null;

  // Watch/Shorts URLs resolve to the embed player, then load through the edge
  // proxy inside Radium. Everything else proxies as-is.
  const open = useCallback(
    (raw: string) => {
      const url = normalizeQuery(raw);
      if (!url) return;
      setInput(url);
      setTarget(url);
      setNonce((n) => n + 1);
      setStatus(getYouTubeVideoId(url) ? "Loading player" : `Loading ${url}`);
      pushHistory(url);
    },
    [pushHistory],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <div className="hidden items-center gap-1 sm:flex">
          {[ArrowLeft, ArrowRight, RefreshCw, Home].map((Icon, index) => (
            <button key={index} type="button" aria-label={["Back", "Forward", "Refresh", "Home"][index]} className="toolbar-icon">
              <Icon size={15} />
            </button>
          ))}
        </div>
        <form
          className="min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            open(input);
          }}
        >
          <div
            className="flex h-9 items-center gap-2 rounded-sm px-3"
            style={{ background: "var(--rd-search)", border: "1px solid var(--rd-line)" }}
          >
            <LockKeyhole size={13} style={{ color: "var(--rd-accent-alt)" }} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search or enter a web address"
              aria-label="Address bar"
              autoComplete="off"
              className="w-full bg-transparent font-mono text-sm outline-none"
              style={{ color: "var(--rd-search-text)" }}
            />
            <button
              type="submit"
              className="shrink-0 p-1"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
              aria-label="Open address"
            >
              <Search size={14} />
            </button>
          </div>
        </form>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-4 py-1.5 font-mono text-[11px] tracking-[0.12em]"
        style={{ borderTop: "1px solid var(--rd-line)", borderBottom: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="truncate">{status}</span>
        <span className="shrink-0" style={{ color: "var(--rd-accent-alt)" }}>EDGE PROXY · ENCRYPTED</span>
      </div>

      <div className="relative min-h-0 flex-1">
        {frameSrc ? (
          <>
            <iframe
              key={`web-${nonce}`}
              src={frameSrc}
              title="Proxied content"
              className="h-full w-full"
              style={{ border: "none", background: "var(--rd-bg)" }}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setStatus("Transport ready")}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-presentation"
            />
            <button
              onClick={() => {
                setTarget(null);
                setInput("");
                setStatus("Transport ready");
              }}
              className="absolute right-3 bottom-3 rounded-md px-3 py-1.5 font-mono text-[11px]"
              style={{ background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" }}
            >
              CLOSE
            </button>
          </>
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
        className="radium-grid h-full overflow-auto px-4 py-10"
      style={{
        backgroundImage:
          "linear-gradient(var(--rd-line) 1px, transparent 1px), linear-gradient(90deg, var(--rd-line) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
      }}
    >
        <div className="relative mx-auto max-w-[680px] pt-[2vh] sm:pt-[4vh]">
        <div
          className="absolute inset-0 translate-x-3 translate-y-3 rounded-sm"
          style={{ border: "2px solid var(--rd-accent)" }}
          aria-hidden
        />
        <div
            className="relative px-6 py-10 text-center sm:px-12 sm:py-12"
          style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}
        >
          <div className="mb-6 flex justify-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-md text-3xl font-bold"
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
          <h1 className="mx-auto mt-4 max-w-xl text-4xl font-bold leading-[1.02] sm:text-6xl">
            The web,
            <br />
            uncontained.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-sm" style={{ color: "var(--rd-muted)" }}>
            Enter an address above or launch a site through Radium's accelerated encrypted
            transport.
          </p>
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => open(searchUrl("radium client"))}
              className="flex items-center justify-center gap-2 rounded-sm px-8 py-3 text-sm font-semibold"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)", border: "1px solid var(--rd-accent)" }}
            >
              <Search size={15} /> Search
            </button>
            <button
              onClick={() => open("https://github.com/")}
              className="flex items-center justify-center gap-2 rounded-sm px-8 py-3 text-sm"
              style={{ background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" }}
            >
              <Code2 size={15} /> GitHub
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

type Provider = "invidious" | "piped";

function YouTubeTab() {
  const [provider, setProvider] = useState<Provider>("piped");
  const options = <OptionsMenu provider={provider} onPick={setProvider} />;
  return provider === "piped" ? (
    <PipedView key="piped" options={options} />
  ) : (
    <InvidiousView key="invidious" options={options} />
  );
}

const btnStyle = {
  background: "var(--rd-button)",
  color: "var(--rd-button-text)",
  border: "1px solid var(--rd-line)",
} as const;

function OptionsMenu({ provider, onPick }: { provider: Provider; onPick: (p: Provider) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md px-4 py-2 text-xs" style={btnStyle}>
        Options · {provider === "piped" ? "Piped" : "Invidious"}
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md text-xs"
          style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}
        >
          {(["piped", "invidious"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                onPick(p);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left"
              style={{ color: p === provider ? "var(--rd-accent)" : "var(--rd-text)" }}
            >
              Connect to {p === "piped" ? "Piped" : "Invidious"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMBED = "__embed__";

function PipedView({ options }: { options: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Finding a working Piped server…");
  const [instance, setInstance] = useState<string | null>(null);
  const [results, setResults] = useState<PipedItem[]>([]);
  const [video, setVideo] = useState<PipedVideo | null>(null);
  const [quality, setQuality] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pipedTrending().then((r) => {
      if (!r.success) return setStatus(`${r.error} — try searching`);
      setInstance(r.instance);
      setResults(r.results);
      setStatus(`Trending · ${r.results.length} videos`);
    });
  }, []);

  const open = async (id: string) => {
    const card = results.find((x) => x.videoId === id);
    const fallback: PipedVideo = {
      videoId: id,
      title: card?.title ?? "Video",
      author: card?.author ?? "",
      views: card?.views ?? null,
      duration: card?.duration ?? null,
      description: "",
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      hls: null,
      streams: [],
    };
    setBusy(true);
    setStatus("Loading streams…");
    const r = await pipedStreams(id);
    setBusy(false);
    if (!r.success || !r.video.streams.length) {
      setVideo(fallback);
      setQuality(EMBED);
      setStatus(`${fallback.title} · backup player (Piped streams unavailable)`);
      return;
    }
    setInstance(r.instance);
    setVideo(r.video);
    setQuality(r.video.streams[0].url);
    setStatus(r.video.title);
  };

  const onStreamError = () => {
    if (!video) return;
    const i = video.streams.findIndex((s) => s.url === quality);
    const next = video.streams[i + 1];
    if (next) {
      setQuality(next.url);
      setStatus(`Stream failed — trying ${next.quality}`);
    } else {
      setQuality(EMBED);
      setStatus(`${video.title} · switched to backup player`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;
    const id = getYouTubeVideoId(raw) ?? (/^[\w-]{11}$/.test(raw) ? raw : null);
    if (id) return void open(id);
    setBusy(true);
    setVideo(null);
    setStatus(`Searching “${raw}”…`);
    const r = await pipedSearch(raw);
    setBusy(false);
    if (!r.success) return setStatus(r.error);
    setInstance(r.instance);
    setResults(r.results);
    setStatus(`${r.results.length} results for “${raw}”`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <form className="min-w-[200px] flex-1" onSubmit={submit}>
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2"
            style={{ background: "var(--rd-search)", border: "1px solid var(--rd-line)" }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search via Piped or paste a video link"
              aria-label="Piped search"
              className="w-full bg-transparent font-mono text-sm outline-none"
              style={{ color: "var(--rd-search-text)" }}
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded px-3 py-1 text-xs font-medium disabled:opacity-60"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              Search
            </button>
          </div>
        </form>
        {options}
        {video && (
          <button onClick={() => setVideo(null)} className="rounded-md px-4 py-2 text-xs" style={btnStyle}>
            ← Back
          </button>
        )}
      </div>
      <div
        className="flex items-center justify-between gap-3 px-4 py-1.5 font-mono text-[11px] tracking-[0.12em]"
        style={{ borderTop: "1px solid var(--rd-line)", borderBottom: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="truncate">{status}</span>
        <span className="shrink-0" style={{ color: "var(--rd-accent-alt)" }}>
          PIPED · {instance ? new URL(instance).hostname : "SEARCHING"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {video ? (
          <div className="space-y-3">
            {quality === EMBED ? (
              <iframe
                key={video.videoId}
                src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&mute=1&rel=0&hl=en&gl=SG&playsinline=1`}
                title={video.title}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video w-full rounded-md border-0"
                style={{ background: "var(--rd-surface)" }}
              />
            ) : (
              <video
                key={quality}
                src={quality || undefined}
                poster={video.thumbnail}
                controls
                autoPlay
                playsInline
                className="aspect-video w-full rounded-md"
                style={{ background: "var(--rd-surface)" }}
                onError={onStreamError}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>QUALITY</span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="rounded px-2 py-1 text-xs"
                style={{ ...btnStyle }}
              >
                {video.streams.map((s) => (
                  <option key={s.url} value={s.url}>
                    {s.quality}
                  </option>
                ))}
                <option value={EMBED}>Backup player</option>
              </select>
            </div>
            <h2 className="text-base font-medium" style={{ color: "var(--rd-text)" }}>{video.title}</h2>
            <p className="font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>
              {[video.author, formatViews(video.views), formatDuration(video.duration)].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => (
              <button
                key={v.videoId}
                onClick={() => void open(v.videoId)}
                className="overflow-hidden rounded-lg text-left"
                style={{ background: "var(--rd-button)", border: "1px solid var(--rd-line)" }}
              >
                <img
                  src={v.thumbnail ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`}
                  onError={(e) => {
                    const fb = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
                    if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                  }}
                  alt=""
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-xs font-medium" style={{ color: "var(--rd-text)" }}>{v.title}</p>
                  <p className="truncate font-mono text-[10px]" style={{ color: "var(--rd-muted)" }}>
                    {[v.author, formatViews(v.views), formatDuration(v.duration)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InvidiousView({ options }: { options: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading trending…");
  const [results, setResults] = useState<InvidiousVideo[]>([]);
  const [selected, setSelected] = useState<InvidiousVideo | null>(null);
  const [comments, setComments] = useState<InvidiousComment[]>([]);
  const [busy, setBusy] = useState(false);
  const [playerState, setPlayerState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadTrending = useCallback(async () => {
    setBusy(true);
    setStatus("Loading trending…");
    const res = await getTrending({ region: "SG" });
    setBusy(false);
    if (!res.success) return setStatus(res.error);
    setResults(res.results);
    setStatus(`Trending · ${res.results.length} videos`);
  }, []);

  useEffect(() => {
    void loadTrending();
  }, [loadTrending]);

  const openVideo = (v: InvidiousVideo) => {
    if (!v.videoId) return;
    setSelected(v);
    setComments([]);
    setPlayerState("loading");
    setStatus(v.title || "Opening player…");

    const videoId = v.videoId;
    void getVideo(videoId).then((meta) => {
      if (!meta.success) return;
      setSelected((current) =>
        current?.videoId === videoId ? { ...current, ...meta.video } : current,
      );
    });
    void getComments(videoId).then((response) => {
      if (!response.success) return;
      setSelected((current) => {
        if (current?.videoId === videoId) setComments(response.comments);
        return current;
      });
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;
    const videoId = getYouTubeVideoId(raw);
    if (videoId) {
      openVideo({
        videoId,
        title: videoId,
        author: "",
        authorId: null,
        viewCount: null,
        published: null,
        publishedText: null,
        lengthSeconds: null,
        liveNow: false,
        thumbnail: null,
        description: null,
      });
      return;
    }
    setBusy(true);
    setSelected(null);
    setStatus(`Searching “${raw}”…`);
    const res = await searchVideos(raw, { region: "SG" });
    setBusy(false);
    if (!res.success) return setStatus(res.error);
    setResults(res.results);
    setStatus(`${res.results.length} results for “${raw}”`);
  };

  const embed = selected?.videoId
    ? `https://www.youtube-nocookie.com/embed/${selected.videoId}?autoplay=1&rel=0&hl=en&gl=SG&playsinline=1`
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <form className="min-w-[200px] flex-1" onSubmit={submit}>
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2"
            style={{ background: "var(--rd-search)", border: "1px solid var(--rd-line)" }}
          >
            <span className="text-xs" style={{ color: "var(--rd-accent-alt)" }}>
              ▶
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube or paste a video link"
              aria-label="YouTube search"
              autoComplete="off"
              className="w-full bg-transparent font-mono text-sm outline-none"
              style={{ color: "var(--rd-search-text)" }}
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded px-3 py-1 text-xs font-medium disabled:opacity-60"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              Search
            </button>
          </div>
        </form>
        {options}
        {selected && (
          <button
            onClick={() => {
              setSelected(null);
              setComments([]);
            }}
            className="rounded-md px-4 py-2 text-xs"
            style={{
              background: "var(--rd-button)",
              color: "var(--rd-button-text)",
              border: "1px solid var(--rd-line)",
            }}
          >
            ← Back
          </button>
        )}
      </div>

      <div
        className="flex items-center justify-between gap-3 px-4 py-1.5 font-mono text-[11px] tracking-[0.12em]"
        style={{
          borderTop: "1px solid var(--rd-line)",
          borderBottom: "1px solid var(--rd-line)",
          color: "var(--rd-muted)",
        }}
      >
        <span className="truncate">{status}</span>
        <span className="shrink-0" style={{ color: "var(--rd-accent-alt)" }}>
          DIRECT PLAYER · OPTIONAL DETAILS
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selected ? (
          <div className="space-y-4">
            {embed && (
              <div className="relative aspect-video w-full overflow-hidden rounded-md" style={{ background: "var(--rd-surface)" }}>
                <iframe
                  key={embed}
                  src={embed}
                  title={selected.title}
                  className="h-full w-full"
                  style={{ border: "none" }}
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => {
                    setPlayerState("ready");
                    setStatus(selected.title || "Player ready");
                  }}
                  onError={() => {
                    setPlayerState("error");
                    setStatus("The video player could not load. Try another video.");
                  }}
                />
                {playerState === "loading" && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 font-mono text-[10px]" style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}>
                    Connecting to player…
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <h2 className="text-base font-medium" style={{ color: "var(--rd-text)" }}>
                {selected.title}
              </h2>
              <p className="font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>
                {[
                  selected.author,
                  formatViews(selected.viewCount),
                  selected.publishedText,
                  formatDuration(selected.lengthSeconds),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {selected.description && (
              <p
                className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs"
                style={{ color: "var(--rd-muted)" }}
              >
                {selected.description}
              </p>
            )}
            <div className="space-y-3">
              <h3 className="font-mono text-[11px] tracking-[0.12em]" style={{ color: "var(--rd-accent-alt)" }}>
                COMMENTS {comments.length ? `· ${comments.length}` : ""}
              </h3>
              {comments.length === 0 && (
                <p className="text-xs" style={{ color: "var(--rd-muted)" }}>
                  No comments loaded.
                </p>
              )}
              {comments.map((c, i) => (
                <div key={c.commentId ?? i} className="space-y-1">
                  <p className="font-mono text-[11px]" style={{ color: "var(--rd-accent)" }}>
                    {c.author} · {c.publishedText ?? ""} · ♥ {c.likeCount}
                  </p>
                  <p className="text-xs" style={{ color: "var(--rd-text)" }}>
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => (
              <button
                key={v.videoId}
                onClick={() => openVideo(v)}
                className="overflow-hidden rounded-lg text-left"
                style={{ background: "var(--rd-button)", border: "1px solid var(--rd-line)" }}
              >
                {v.thumbnail && (
                  <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                )}
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-xs font-medium" style={{ color: "var(--rd-text)" }}>
                    {v.title}
                  </p>
                  <p className="truncate font-mono text-[10px]" style={{ color: "var(--rd-muted)" }}>
                    {[v.author, formatViews(v.viewCount), formatDuration(v.lengthSeconds)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </button>
            ))}
            {results.length === 0 && !busy && (
              <p className="text-xs" style={{ color: "var(--rd-muted)" }}>
                Nothing to show yet.
              </p>
            )}
          </div>
        )}
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

  const rowClass = "grid gap-4 border-b py-6 sm:grid-cols-[minmax(0,1fr)_minmax(260px,44%)] sm:items-center";
  const rowStyle = { borderColor: "var(--rd-line)" };
  const accentChoices = ["#c2f53c", "#19d3d1", "#f044b7", "#ff9418"];

  const rowCopy = (title: string, hint: string) => (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--rd-muted)" }}>{hint}</p>
    </div>
  );

  return (
    <div className="h-full overflow-auto px-5 sm:px-8">
      <div className="mx-auto max-w-5xl pb-8">
        <section className={rowClass} style={rowStyle}>
          {rowCopy("Transport", "Network engine used for proxied requests")}
          <select aria-label="Transport" value={settings.transport} onChange={() => undefined} className="h-11 rounded-sm px-3 font-mono text-xs outline-none" style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }}>
            <option value="edge">Edge proxy</option>
          </select>
        </section>

        <section className={rowClass} style={rowStyle}>
          {rowCopy("Wisp server", "Encrypted relay endpoint")}
          <input aria-label="Wisp server" value={settings.wispServer} onChange={(e) => updateSettings({ wispServer: e.target.value })} className="h-11 rounded-sm px-3 font-mono text-xs outline-none" style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }} />
        </section>

        <section className={rowClass} style={rowStyle}>
          {rowCopy("Home page", "Opens when you select Home")}
          <input aria-label="Home page" value={settings.homePage} onChange={(e) => updateSettings({ homePage: e.target.value })} className="h-11 rounded-sm px-3 font-mono text-xs outline-none" style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }} />
        </section>

        <section className={rowClass} style={rowStyle}>
          {rowCopy("HTTP cache", "Reuse recent responses for faster browsing")}
          <label className="justify-self-start sm:justify-self-end">
            <span className="sr-only">HTTP cache</span>
            <input type="checkbox" checked={settings.httpCache} onChange={(e) => updateSettings({ httpCache: e.target.checked })} className="peer sr-only" />
            <span className="flex h-7 w-12 items-center rounded-full p-1 transition-colors peer-focus-visible:outline-2" style={{ background: settings.httpCache ? "var(--rd-accent)" : "var(--rd-button)" }}>
              <span className="h-5 w-5 rounded-full transition-transform" style={{ background: "var(--rd-bg)", transform: settings.httpCache ? "translateX(20px)" : "translateX(0)" }} />
            </span>
          </label>
        </section>

        <section className={rowClass} style={rowStyle}>
          {rowCopy("Interface mode", "Switch between dark and white workspaces")}
          <button onClick={() => setTheme(PRESET_THEMES.find((p) => p.mode !== theme.mode) ?? theme)} className="flex h-10 items-center gap-2 justify-self-start rounded-sm px-4 text-xs sm:justify-self-end" style={{ background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" }}>
            {theme.mode === "dark" ? <Moon size={15} style={{ color: "var(--rd-accent)" }} /> : <Sun size={15} style={{ color: "var(--rd-accent)" }} />}
            {theme.mode === "dark" ? "Dark" : "White"}
          </button>
        </section>

        <section className={rowClass} style={rowStyle}>
          {rowCopy("Client colour", "Choose Radium's active signal colour")}
          <div className="flex gap-3 justify-self-start sm:justify-self-end">
            {accentChoices.map((color) => (
              <button key={color} aria-label={`Use ${color} accent`} onClick={() => update("accent", color)} className="flex h-9 w-9 items-center justify-center rounded-sm" style={{ background: color, outline: theme.accent.toLowerCase() === color.toLowerCase() ? "2px solid var(--rd-text)" : "1px solid var(--rd-line)", outlineOffset: "3px" }}>
                {theme.accent.toLowerCase() === color.toLowerCase() && <span style={{ color: "var(--rd-bg)" }}>✓</span>}
              </button>
            ))}
          </div>
        </section>

        <details className="border-b py-5" style={rowStyle}>
          <summary className="cursor-pointer text-sm font-semibold">Advanced appearance</summary>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {THEME_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{f.label}</span>
                <input type="color" value={String(theme[f.key] ?? "#000000")} onChange={(e) => update(f.key, e.target.value)} className="h-8 w-14 cursor-pointer border-0 bg-transparent" />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="rounded-sm px-3 py-2 text-sm outline-none" style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }} placeholder="Theme name" />
            <button onClick={() => { const saved: Theme = { ...theme, id: `custom-${Date.now()}`, name: draftName || "My theme", preset: false }; saveTheme(saved); setTheme(saved); }} className="rounded-sm px-4 py-2 text-sm font-medium" style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}>Save theme</button>
          </div>
        </details>

        {customThemes.length > 0 && (
          <section className="border-b py-5" style={rowStyle}>
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

        <section className="border-b py-5" style={rowStyle}>
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

        <section className="border-b py-5" style={rowStyle}>
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
