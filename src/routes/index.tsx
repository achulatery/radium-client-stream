import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Home,
  LockKeyhole,
  Moon,
  Music,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Youtube,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PingCounter, RadiumMark, SingaporeClock } from "@/components/radium-ui";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { canToggleSafeSearch } from "@/lib/account-permissions";
import { applySearchPolicy, browserDestination, cleanBrowserAddress, safeSearchEnabled, searchQueryOf } from "@/lib/browser-policy";
import { isHostingErrorPage, resetUltraviolet, setupUltraviolet, uvTargetOf, uvUrl } from "@/lib/ultraviolet";
import {
  formatDuration,
  formatViews,
  getComments,

  getVideo,
  searchVideos,
  type InvidiousComment,
  type InvidiousVideo,
} from "@/lib/invidious";
import {
  getYouTubeVideoId,
  normalizeQuery,
  useRadium,
  videoPlayerUrl,
} from "@/lib/radium";
import { pipedMore, pipedSearch, pipedStreams, type PipedItem, type PipedVideo } from "@/lib/piped";
import { track } from "@/lib/track";
import { firstUsable, preloadVideo } from "@/lib/video-loading";
import { useAccount } from "@/lib/account";
import { AuthScreen } from "@/components/auth-screen";
import { Avatar, ProfileDialog } from "@/components/profile";
import { PRESET_THEMES, type Theme } from "@/lib/themes";
import { saveSettings } from "@/lib/account.functions";

const MusicTab = lazy(() => import("@/components/music-tab").then((m) => ({ default: m.MusicTab })));
const ChatTab = lazy(() => import("@/components/chat-tab").then((m) => ({ default: m.ChatTab })));
const ConsoleTab = lazy(() => import("@/components/console-tab").then((m) => ({ default: m.ConsoleTab })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radium Client" },
      {
        name: "description",
        content:
          "Search with DuckDuckGo, browse sites through Ultraviolet, chat with friends and play music in one themeable client.",
      },
      { property: "og:title", content: "Radium Client" },
      {
        property: "og:description",
        content: "Search with DuckDuckGo, browse sites through Ultraviolet, chat with friends and play music in one themeable client.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RadiumApp,
});

type Tab = "chat" | "browser" | "youtube" | "music" | "settings" | "console";

function RadiumApp() {
  const account = useAccount();
  const { hydrate } = useRadium();
  const userId = account.user?.id;
  useEffect(() => {
    if (account.user) hydrate(account.user.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  if (account.loading) {
    return <div className="flex h-screen items-center justify-center font-mono text-xs tracking-[0.3em]" style={{ background: "var(--rd-bg)", color: "var(--rd-muted)" }}>LOADING…</div>;
  }
  if (!account.user) return <AuthScreen />;
  return <ClientShell />;
}

function ClientShell() {
  const [tab, setTab] = useState<Tab>("browser");
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(["browser"]));
  const { theme, toggleMode, settings } = useRadium();
  const { user, signOut } = useAccount();
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if (user?.blockedTabs.includes(tab)) setTab("settings");
  }, [user?.blockedTabs, tab]);

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
          {settings.singaporeClock && <span className="hidden lg:inline-flex"><SingaporeClock /></span>}
          <PingCounter />
          <button
            onClick={toggleMode}
            aria-label="Toggle dark and light mode"
            className="flex h-8 w-8 items-center justify-center rounded-sm"
            style={{ background: "var(--rd-button)", color: "var(--rd-accent)" }}
          >
            <Sun size={14} />
          </button>
          <button onClick={() => setProfileOpen(true)} title="Edit profile" className="flex max-w-28 items-center gap-1.5 truncate font-mono text-[11px] sm:max-w-52" style={{ color: "var(--rd-text)" }}>
            <Avatar src={user?.avatar} name={user?.username ?? "?"} size={22} />
            <span className="truncate">{user?.username}</span>
          </button>
          {profileOpen && <ProfileDialog editable onClose={() => setProfileOpen(false)} />}
          <button onClick={() => void signOut()} className="shrink-0 whitespace-nowrap rounded-sm px-2 py-1 font-mono text-[10px]" style={{ background: "var(--rd-button)", color: "var(--rd-accent)" }}>
            SIGN OUT
          </button>
        </div>
      </header>

      <nav className="flex h-11 shrink-0 items-stretch gap-0 overflow-x-auto px-3" style={{ background: "var(--rd-surface)", borderBottom: "1px solid var(--rd-line)" }}>
        {(
          [
            ["browser", "Browser"],
            ["chat", "Chat"],
            ["youtube", "YouTube"],
            ["music", "Music"],
            ["settings", "Settings"],
            ...(user?.isAdmin ? ([["console", "Console"]] as [Tab, string][]) : []),
          ] as [Tab, string][]).filter(([id]) => !user?.blockedTabs.includes(id)
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setVisited((previous) => previous.has(id) ? previous : new Set([...previous, id])); setTab(id); }}
            className="flex shrink-0 items-center justify-center gap-2 border-x px-3 text-xs transition-colors"
            style={{
              color: tab === id ? "var(--rd-text)" : "var(--rd-muted)",
              background: tab === id ? "var(--rd-bg)" : "transparent",
              borderBottom: `2px solid ${tab === id ? "var(--rd-accent-alt)" : "transparent"}`,
              borderLeftColor: tab === id ? "var(--rd-line)" : "transparent",
              borderRightColor: tab === id ? "var(--rd-line)" : "transparent",
            }}
          >
            {id === "browser" ? <ShieldCheck size={13} className="text-client-signal" /> : id === "chat" ? <MessageSquare size={13} className="text-client-signal" /> : id === "youtube" ? <Youtube size={14} className="text-client-signal" /> : id === "music" ? <Music size={13} className="text-client-signal" /> : id === "console" ? <LockKeyhole size={13} className="text-client-signal" /> : <Settings size={13} className="text-client-signal" />}
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        {!user?.blockedTabs.includes("browser") && <div className={tab === "browser" ? "rd-menu-enter h-full" : "hidden"}><BrowserTab /></div>}
        <Suspense fallback={<div className="rc-tab-loading"><RefreshCw size={18} className="animate-spin" /><span>Loading…</span></div>}>
        {visited.has("chat") && !user?.blockedTabs.includes("chat") && <div className={tab === "chat" ? "rd-menu-enter h-full" : "hidden"}><ChatTab visible={tab === "chat"} /></div>}
        {tab === "youtube" && !user?.blockedTabs.includes("youtube") && <div className="rd-menu-enter h-full"><YouTubeTab /></div>}
        {visited.has("music") && !user?.blockedTabs.includes("music") && <div className={tab === "music" ? "rd-menu-enter h-full" : "hidden"}>
          <MusicTab />
        </div>}
        {tab === "settings" && <div className="rd-menu-enter h-full"><SettingsTab /></div>}
        {visited.has("console") && user?.isAdmin && <div className={tab === "console" ? "rd-menu-enter h-full" : "hidden"}><ConsoleTab visible={tab === "console"} /></div>}
        </Suspense>
      </div>

      <footer
        className="flex items-center justify-between px-4 py-2 font-mono text-[11px] tracking-[0.2em]"
        style={{ borderTop: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="flex items-center gap-2">
          <ShieldCheck size={12} style={{ color: "var(--rd-accent-alt)" }} />
          RADIUM SESSION
        </span>
      </footer>
    </div>
  );
}

function BrowserTab() {
  const { settings, theme, updateSettings, pushHistory } = useRadium();
  const { user } = useAccount();
  const safe = safeSearchEnabled(user?.role ?? null, settings.duckduckgoSafeSearch);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [nonce, setNonce] = useState(0);
  const [savingSearch, setSavingSearch] = useState(false);
  const [entries, setEntries] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef<string | null>(null);
  const addressFocused = useRef(false);
  const videoId = target ? getYouTubeVideoId(target) : null;
  const [uvReady, setUvReady] = useState(false);
  const [uvStarting, setUvStarting] = useState(true);
  const [uvAttempt, setUvAttempt] = useState(0);
  const visitedHome = useRef(false);

  // Ultraviolet proxies clicked sites inside the browser via a service worker;
  // Never load a website until the Ultraviolet transport is verified.
  useEffect(() => {
    let live = true;
    setUvStarting(true);
    void setupUltraviolet(settings.wispServer).then((ok) => {
      if (live) { setUvReady(ok); setUvStarting(false); }
    });
    return () => {
      live = false;
    };
  }, [settings.wispServer, uvAttempt]);

  const frameSrc = target && uvReady
    ? uvUrl(videoId ? videoPlayerUrl(videoId) : target)
    : null;

  const remember = useCallback((url: string) => {
    if (url === current.current) return;
    current.current = url;
    setTarget(url);
    if (!addressFocused.current) setInput(cleanBrowserAddress(url));
    setEntries((previous) => [...previous.slice(0, cursor + 1), url]);
    setCursor((previous) => previous + 1);
    pushHistory(url);
  }, [cursor, pushHistory]);

  // Radium visits DuckDuckGo itself: the home page and every search load
  // through Ultraviolet like any other site, so results and clicks stay
  // inside the same proxied session.
  const home = applySearchPolicy(new URL("https://duckduckgo.com/"), safe).href;

  const open = useCallback((raw: string) => {
    const normalized = normalizeQuery(raw);
    if (!normalized) return;
    const query = searchQueryOf(normalized);
    const destination = query
      ? `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      : browserDestination(normalized);
    if (!destination) return;
    const url = applySearchPolicy(new URL(destination), safe).href;
    remember(url);
    setInput(cleanBrowserAddress(url));
    setNonce((n) => n + 1);
    setStatus("Loading page");
  }, [remember, safe]);

  // The Browser starts by visiting DuckDuckGo.
  useEffect(() => {
    if (visitedHome.current) return;
    visitedHome.current = true;
    open(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const travel = (next: number) => {
    const url = entries[next];
    if (!url) return;
    current.current = url;
    setCursor(next); setTarget(url); setInput(cleanBrowserAddress(url));
    setNonce((n) => n + 1); setStatus("Loading page");
  };

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object" || !["navigate", "loaded"].includes(event.data.__radium) || typeof event.data.url !== "string") return;
      const url = browserDestination(event.data.url);
      if (!url) return;
      if (event.data.__radium === "navigate") open(url);
      else { remember(url); setStatus("Ready"); }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [remember, open]);

  return <div className="flex h-full flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="toolbar-icon" aria-label="Back" title="Back" disabled={cursor <= 0} onClick={() => travel(cursor - 1)}><ArrowLeft size={15} /></Button>
        <Button variant="ghost" size="icon" className="toolbar-icon" aria-label="Forward" title="Forward" disabled={cursor >= entries.length - 1} onClick={() => travel(cursor + 1)}><ArrowRight size={15} /></Button>
        <Button variant="ghost" size="icon" className="toolbar-icon" aria-label="Refresh" title="Refresh" disabled={!target} onClick={() => { setNonce((n) => n + 1); setStatus("Loading page"); }}><RefreshCw size={15} /></Button>
      </div>
      <form className="min-w-0 flex-1 basis-40" onSubmit={(e) => { e.preventDefault(); open(input); }}>
        <div className="flex h-9 items-center gap-2 rounded-sm border border-client-line bg-client-search px-2 text-client-search-text">
          <Button variant="ghost" size="icon" type="button" className="h-6 w-6 shrink-0 text-client-signal" aria-label="Home" title="Home" onClick={() => open(home)}><Home size={14} /></Button>
          <input value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => { addressFocused.current = true; }} onBlur={() => { addressFocused.current = false; }} placeholder="Search or enter a web address" aria-label="Address bar" autoComplete="off" className="min-w-0 w-full bg-transparent font-mono text-sm outline-none" />
          <Button variant="ghost" size="icon" type="submit" className="h-6 w-6 shrink-0 text-client-signal" aria-label="Open address"><Search size={14} /></Button>
        </div>
      </form>
      <label className="flex shrink-0 items-center gap-2 text-xs text-client-muted"><ShieldCheck size={14} />Safe Search<Switch aria-label="DuckDuckGo Safe Search" checked={safe} disabled={savingSearch || !canToggleSafeSearch(user?.role ?? null)} onCheckedChange={(value) => { setSavingSearch(true); void saveSettings({ data: { settings: { ...settings, duckduckgoSafeSearch: value }, theme } }).then(() => { updateSettings({ duckduckgoSafeSearch: value }); if (target && new URL(target).hostname.endsWith("duckduckgo.com")) { const next = applySearchPolicy(new URL(target), value).href; current.current = next; setTarget(next); setInput(cleanBrowserAddress(next)); setNonce((n) => n + 1); } }).catch(() => setStatus("Could not save Safe Search preference")).finally(() => setSavingSearch(false)); }} /></label>
      {target && <Button variant="ghost" size="icon" aria-label="Open in browser" title="Open in browser" onClick={() => window.open(target, "_blank", "noopener,noreferrer")}><ExternalLink size={15} /></Button>}
    </div>
    <span className="sr-only" aria-live="polite">{status}</span>
    <div className="relative min-h-0 flex-1">
      {frameSrc ? <iframe ref={frame} key={`web-${nonce}`} src={frameSrc} title="Proxied content" className="h-full w-full border-0 bg-client-background" loading="eager" referrerPolicy="same-origin" onLoad={() => { setStatus("Ready"); try { if (uvReady && isHostingErrorPage(frame.current?.contentDocument?.body?.innerText)) { setStatus("Ultraviolet connection unavailable"); setUvReady(false); void resetUltraviolet(); return; } const url = frame.current?.contentWindow?.location.href; if (url) { const destination = browserDestination(url) ?? uvTargetOf(url); if (destination) remember(destination); } } catch { /* Provider navigated outside the proxy. */ } }} sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-presentation" /> : target ? <div className="flex h-full flex-col items-center justify-center gap-4 text-client-muted"><ShieldCheck size={28} /><p>{uvStarting ? "Connecting…" : "Ultraviolet could not connect on this network."}</p>{!uvStarting && <Button variant="secondary" onClick={() => { setUvReady(false); setUvAttempt((n) => n + 1); }}><RefreshCw size={14} />Retry connection</Button>}</div> : <div className="flex h-full items-center justify-center text-sm text-client-muted">Connecting…</div>}
    </div>
  </div>;
}

type Provider = "invidious" | "piped";
function YouTubeTab() {
  const [provider, setProvider] = useState<Provider>("invidious");
  const options = <OptionsMenu provider={provider} onPick={setProvider} />;
  return provider === "piped" ? <PipedView options={options} /> : <InvidiousView options={options} />;
}

function VideoStartScreen({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="radium-grid video-start h-full overflow-auto px-4 py-10">
      <div className="relative mx-auto max-w-[680px] pt-[2vh] sm:pt-[4vh]">
        <div className="video-start-outline absolute inset-0 translate-x-3 translate-y-3 rounded-sm" aria-hidden />
        <div className="video-start-panel relative px-6 py-10 text-center sm:px-12 sm:py-12">
          <div className="mb-6 flex justify-center"><RadiumMark size={64} /></div>
          <p className="video-start-muted font-mono text-xs">RADIUM CLIENT · YOUTUBE</p>
          <h1 className="mx-auto mt-4 max-w-xl text-4xl font-bold leading-[1.02] sm:text-6xl">Find your<br />next video.</h1>
          <p className="video-start-muted mx-auto mt-6 max-w-md text-sm">Search YouTube or paste a video link.</p>
          <Button onClick={onSearch} className="video-search-button mt-8 px-8"><Search size={15} /> Search YouTube</Button>
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "var(--rd-button)",
  color: "var(--rd-button-text)",
  border: "1px solid var(--rd-line)",
} as const;

function OptionsMenu({ provider, onPick }: { provider: Provider; onPick: (p: Provider) => void }) {
  return (
    <select aria-label="Video provider" value={provider} onChange={(e) => onPick(e.target.value as Provider)}
      className="video-provider h-9 max-w-full rounded-sm px-2 font-mono text-xs">
      <option value="invidious">Invidious</option>
      <option value="piped">Piped</option>
    </select>
  );
}

const EMBED = "__embed__";

function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={`sk-${i}`} className="overflow-hidden rounded-lg animate-pulse" style={{ background: "var(--rd-button)", border: "1px solid var(--rd-line)" }} aria-hidden>
          <div className="aspect-video w-full" style={{ background: "var(--rd-surface)" }} />
          <div className="space-y-2 p-2">
            <div className="h-3 w-4/5 rounded" style={{ background: "var(--rd-surface)" }} />
            <div className="h-2 w-1/2 rounded" style={{ background: "var(--rd-surface)" }} />
          </div>
        </div>
      ))}
    </>
  );
}

function useBottom(cb: () => void) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) ref.current(); }, { rootMargin: "500px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return setEl;
}

const pipedToInv = (v: PipedItem): InvidiousVideo => ({
  videoId: v.videoId, title: v.title, author: v.author, authorId: null, viewCount: v.views, published: null,
  publishedText: v.uploaded, lengthSeconds: v.duration, liveNow: false, thumbnail: v.thumbnail, description: null,
});
const invToPiped = (v: InvidiousVideo): PipedItem => ({
  videoId: v.videoId ?? "", title: v.title, author: v.author, views: v.viewCount, uploaded: v.publishedText,
  duration: v.lengthSeconds, thumbnail: v.thumbnail,
});

function PipedView({ options }: { options: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [started, setStarted] = useState(false);
  const activeId = useRef<string | null>(null);
  const [results, setResults] = useState<PipedItem[]>([]);
  const [video, setVideo] = useState<PipedVideo | null>(null);
  const [quality, setQuality] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState("gaming");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [src, setSrc] = useState<"piped" | "invidious">("piped");
  const moreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const runSearch = useCallback(async (q: string, label: string) => {
    setStarted(true);
    activeId.current = null;
    setBusy(true);
    setResults([]);
    setVideo(null);
    setStatus(`Loading ${label}…`);
    setTerm(q);
    setPage(1);
    setNext(null);
    const r = await firstUsable<{ source: Provider; results: PipedItem[]; next: string | null }>([
      pipedSearch(q).then((r) => r.success ? { source: "piped" as const, results: r.results, next: r.nextpage ?? null } : { source: "piped" as const, results: [], next: null }),
      searchVideos(q, { region: "SG" }).then((r) => ({ source: "invidious" as const, results: r.success ? r.results.filter((v) => v.videoId).map(invToPiped) : [], next: null })),
    ], (r) => r.results.length > 0);
    if (r) {
      setSrc(r.source);
      setNext(r.next);
      setResults(r.results);
      setStatus(label);
    } else setStatus("No videos found. Try another search.");
    setBusy(false);
  }, []);

  const loadMore = async () => {
    if (busy || video || moreRef.current || !results.length) return;
    moreRef.current = true;
    setLoadingMore(true);
    let more: PipedItem[] = [];
    if (src === "piped" && next) {
      const r = await pipedMore(term, next);
      if (r.success) { more = r.results; setNext(r.nextpage ?? null); }
    } else if (src === "invidious") {
      const r = await searchVideos(term, { region: "SG", page: page + 1 });
      if (r.success) { more = r.results.filter((v) => v.videoId).map(invToPiped); setPage(page + 1); }
    }
    setResults((cur) => { const seen = new Set(cur.map((v) => v.videoId)); return [...cur, ...more.filter((v) => !seen.has(v.videoId))]; });
    moreRef.current = false;
    setLoadingMore(false);
  };
  const sentinel = useBottom(() => void loadMore());


  const open = async (id: string) => {
    const card = results.find((x) => x.videoId === id);
    track("video", card?.title ?? id, { videoId: id, url: `https://youtube.com/watch?v=${id}` });
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
    setStarted(true);
    activeId.current = id;
    setVideo(fallback);
    setQuality(EMBED);
    setStatus(fallback.title);
    const streams = await preloadVideo(id);
    if (activeId.current !== id || !streams?.length) return;
    setVideo({ ...fallback, streams });
    setQuality(streams[0]?.url ?? EMBED);
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
      setStatus(video.title);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;
    track("search", raw, { source: "youtube" });
    const id = getYouTubeVideoId(raw) ?? (/^[\w-]{11}$/.test(raw) ? raw : null);
    if (id) return void open(id);
    await runSearch(raw, `Results for “${raw}”`);
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
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube or paste a video link"
              aria-label="YouTube search"
              className="w-full bg-transparent font-mono text-sm outline-none"
              style={{ color: "var(--rd-search-text)" }}
            />
            <Button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded px-3 py-1 text-xs font-medium disabled:opacity-60"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              Search
            </Button>
          </div>
        </form>
        {options}
        {video && (
          <button onClick={() => { activeId.current = null; setVideo(null); }} className="rounded-md px-4 py-2 text-xs" style={btnStyle}>
            ← Back
          </button>
        )}
      </div>
      {started && <div
        className="flex items-center justify-between gap-3 px-4 py-1.5 font-mono text-[11px] tracking-[0.12em]"
        style={{ borderTop: "1px solid var(--rd-line)", borderBottom: "1px solid var(--rd-line)", color: "var(--rd-muted)" }}
      >
        <span className="truncate">{status}</span>
      </div>}
      <div className={`min-h-0 flex-1 overflow-y-auto ${started ? "p-3" : ""}`}>
        {!started ? <VideoStartScreen onSearch={() => searchRef.current?.focus()} /> : video ? (
          <div className="space-y-3">
            {quality === EMBED ? (
              <iframe
                key={video.videoId}
                src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&mute=1&rel=0&hl=en&gl=SG&playsinline=1`}
                title={video.title}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className={`w-full rounded-md border-0 aspect-video`}
                style={{ background: "var(--rd-surface)" }}
              />
            ) : (
              <video
                key={quality}
                src={quality ? `/api/stream?url=${encodeURIComponent(quality)}` : undefined}
                preload="auto"
                poster={video.thumbnail}
                controls
                autoPlay
                playsInline
                className={`w-full rounded-md aspect-video`}
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
            {results.map((v, index) => (
              <button
                key={v.videoId}
                onPointerEnter={() => void preloadVideo(v.videoId)}
                onFocus={() => void preloadVideo(v.videoId)}
                onClick={() => void open(v.videoId)}
                className="overflow-hidden rounded-lg text-left"
                style={{ background: "var(--rd-button)", border: "1px solid var(--rd-line)" }}
              >
                <VideoThumbnail videoId={v.videoId} priority={index < 6} />
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-xs font-medium" style={{ color: "var(--rd-text)" }}>{v.title}</p>
                  <p className="truncate font-mono text-[10px]" style={{ color: "var(--rd-muted)" }}>
                    {[v.author, formatViews(v.views), formatDuration(v.duration)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))}
            {(busy && !results.length) || loadingMore ? <SkeletonCards /> : null}
          </div>
        )}
        {started && !video && <div ref={sentinel} className="h-8" />}
      </div>
    </div>
  );
}

function InvidiousView({ options }: { options: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [started, setStarted] = useState(false);
  const [results, setResults] = useState<InvidiousVideo[]>([]);
  const [selected, setSelected] = useState<InvidiousVideo | null>(null);
  const [comments, setComments] = useState<InvidiousComment[]>([]);
  const [busy, setBusy] = useState(false);
  const [, setPlayerState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [term, setTerm] = useState("gaming");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [src, setSrc] = useState<"invidious" | "piped">("invidious");
  const moreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<"resolving" | "stream" | "embed">("resolving");

  const runSearch = useCallback(async (q: string, label: string) => {
    setStarted(true);
    setBusy(true);
    setResults([]);
    setSelected(null);
    setStatus(`Loading ${label}…`);
    setTerm(q);
    setPage(1);
    setNext(null);
    const r = await firstUsable<{ source: Provider; results: InvidiousVideo[]; next: string | null }>([
      searchVideos(q, { region: "SG" }).then((r) => ({ source: "invidious" as const, results: r.success ? r.results : [], next: null })),
      pipedSearch(q).then((r) => ({ source: "piped" as const, results: r.success ? r.results.map(pipedToInv) : [], next: r.success ? r.nextpage ?? null : null })),
    ], (r) => r.results.length > 0);
    if (r) {
      setSrc(r.source);
      setNext(r.next);
      setResults(r.results);
      setStatus(label);
    } else setStatus("No videos found. Try another search.");
    setBusy(false);
  }, []);

  const loadMore = async () => {
    if (busy || selected || moreRef.current || !results.length) return;
    moreRef.current = true;
    setLoadingMore(true);
    let more: InvidiousVideo[] = [];
    if (src === "invidious") {
      const res = await searchVideos(term, { region: "SG", page: page + 1 });
      if (res.success) { more = res.results; setPage(page + 1); }
    } else if (next) {
      const res = await pipedMore(term, next);
      if (res.success) { more = res.results.map(pipedToInv); setNext(res.nextpage ?? null); }
    }
    setResults((cur) => { const seen = new Set(cur.map((v) => v.videoId)); return [...cur, ...more.filter((v) => !seen.has(v.videoId))]; });
    moreRef.current = false;
    setLoadingMore(false);
  };
  const sentinel = useBottom(() => void loadMore());



  const openVideo = (v: InvidiousVideo) => {
    if (!v.videoId) return;
    track("video", v.title ?? v.videoId, { videoId: v.videoId, url: `https://youtube.com/watch?v=${v.videoId}` });
    setSelected(v);
    setComments([]);
    setPlayerState("loading");
    setStreamUrl(null);
    setStarted(true);
    setPlayMode("embed");
    setStatus(v.title || "Opening player…");

    const videoId = v.videoId;
    void getVideo(videoId).then((meta) => {
      if (meta.success) setSelected((current) => current?.videoId === videoId ? { ...current, ...meta.video } : current);
    });
    void preloadVideo(videoId).then((streams) => {
      const url = streams?.[0]?.url;
      if (!url) return;
      setSelected((current) => {
        if (current?.videoId === videoId) { setStreamUrl(url); setPlayMode("stream"); }
        return current;
      });
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
    track("search", raw, { source: "youtube" });
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
    await runSearch(raw, `Results for “${raw}”`);
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
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube or paste a video link"
              aria-label="YouTube search"
              autoComplete="off"
              className="w-full bg-transparent font-mono text-sm outline-none"
              style={{ color: "var(--rd-search-text)" }}
            />
            <Button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded px-3 py-1 text-xs font-medium disabled:opacity-60"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              Search
            </Button>
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

      {started && <div
        className="flex items-center justify-between gap-3 px-4 py-1.5 font-mono text-[11px] tracking-[0.12em]"
        style={{
          borderTop: "1px solid var(--rd-line)",
          borderBottom: "1px solid var(--rd-line)",
          color: "var(--rd-muted)",
        }}
      >
        <span className="truncate">{status}</span>
      </div>}

      <div className={`min-h-0 flex-1 overflow-y-auto ${started ? "p-3" : ""}`}>
        {!started ? <VideoStartScreen onSearch={() => searchRef.current?.focus()} /> : selected ? (
          <div className="space-y-4">
            {playMode === "stream" && streamUrl ? (
              <video
                key={streamUrl}
                src={`/api/stream?url=${encodeURIComponent(streamUrl)}`}
                poster={selected.thumbnail ?? undefined}
                preload="auto"
                controls
                autoPlay
                playsInline
                className="w-full rounded-md aspect-video"
                style={{ background: "var(--rd-surface)" }}
                onLoadedData={() => { setPlayerState("ready"); setStatus(selected.title || "Playing through Radium"); }}
                onError={() => { setStreamUrl(null); setPlayMode("embed"); setStatus(selected.title); }}
              />
            ) : playMode === "resolving" ? (
              <div className="flex w-full items-center justify-center rounded-md aspect-video animate-pulse font-mono text-[11px]" style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}>
                Finding a stream through Radium…
              </div>
            ) : embed && (
              <div className={`relative w-full overflow-hidden rounded-md aspect-video`} style={{ background: "var(--rd-surface)" }}>
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
                  }}
                  onError={() => {
                    setPlayerState("error");
                    setStatus("The video player could not load. Try another video.");
                  }}
                />
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
            {results.map((v, index) => (
              <button
                key={v.videoId}
                onPointerEnter={() => { if (v.videoId) void preloadVideo(v.videoId); }}
                onFocus={() => { if (v.videoId) void preloadVideo(v.videoId); }}
                onClick={() => openVideo(v)}
                className="overflow-hidden rounded-lg text-left"
                style={{ background: "var(--rd-button)", border: "1px solid var(--rd-line)" }}
              >
                 {v.videoId && (
                   <VideoThumbnail videoId={v.videoId} priority={index < 6} />
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
            {(busy && !results.length) || loadingMore ? <SkeletonCards /> : null}
            {results.length === 0 && !busy && (
              <p className="text-xs" style={{ color: "var(--rd-muted)" }}>
                Nothing to show yet.
              </p>
            )}
          </div>
        )}
        {started && !selected && <div ref={sentinel} className="h-8" />}
      </div>
    </div>
  );
}

function SettingsTab() {
  const {
    theme,
    setTheme,
    toggleMode,
    customThemes,
    deleteTheme,
    settings,
    updateSettings,
    history,
    clearHistory,
  } = useRadium();

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
          <Button variant="ghost" onClick={toggleMode} className="flex h-10 items-center gap-2 justify-self-start rounded-sm px-4 text-xs sm:justify-self-end" style={{ background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" }}>
            {theme.mode === "dark" ? <Moon size={15} style={{ color: "var(--rd-accent)" }} /> : <Sun size={15} style={{ color: "var(--rd-accent)" }} />}
            {theme.mode === "dark" ? "Dark" : "White"}
          </Button>
        </section>

        <section className={rowClass} style={rowStyle}>
          {rowCopy("Client colour", "Choose Radium's active signal colour")}
          <div className="flex gap-3 justify-self-start sm:justify-self-end">
            {accentChoices.map((color) => (
              <Button variant="ghost" size="icon" key={color} aria-label={`Use ${color} accent`} aria-pressed={theme.accent.toLowerCase() === color.toLowerCase()} onClick={() => setTheme({ ...theme, accent: color, accentAlt: color, preset: false, name: theme.preset ? "Custom" : theme.name })} className="flex h-9 w-9 items-center justify-center rounded-sm" style={{ background: color, outline: theme.accent.toLowerCase() === color.toLowerCase() ? "2px solid var(--rd-text)" : "1px solid var(--rd-line)", outlineOffset: "3px" }}>
                {theme.accent.toLowerCase() === color.toLowerCase() && <span style={{ color: "var(--rd-bg)" }}>✓</span>}
              </Button>
            ))}
          </div>
        </section>

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
          <div className="history-scroll mt-3 max-h-64 space-y-1 overflow-y-auto rounded-sm p-2 font-mono text-[11px]" style={{ color: "var(--rd-muted)", border: "1px solid var(--rd-line)", background: "var(--rd-bg)" }}>
            {history.length === 0 && <div>No history yet.</div>}
            {history.map((h) => (
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
