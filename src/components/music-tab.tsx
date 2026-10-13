/**
 * Music tab: SoundCloud-style search page. Songs play inside Radium through
 * SoundCloud's official player (kept mounted so playback survives tab switches).
 */
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Copy, Heart, MessageSquare, MoreHorizontal, Pause, Play, Repeat, Repeat1, Repeat2, Search, Share } from "lucide-react";

type Track = {
  id: number; title: string; url: string; artist: string; artwork: string | null; duration: number;
  plays: number | null; likes: number | null; comments?: number | null; genre?: string | null; created?: string | null;
};
type Loop = "off" | "all" | "one";
type Widget = {
  bind: (e: string, cb: (d?: { currentPosition?: number; relativePosition?: number }) => void) => void;
  play: () => void; pause: () => void; seekTo: (ms: number) => void;
};
declare global { interface Window { SC?: { Widget: ((el: HTMLIFrameElement) => Widget) & { Events: { READY: string; PLAY: string; PAUSE: string; PLAY_PROGRESS: string; FINISH: string } } } } }

const fmt = (n: number | null | undefined) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
const time = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const ago = (iso?: string | null) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 864e5;
  if (d < 1) return "today"; if (d < 30) return `${Math.floor(d)} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} months ago`; const y = Math.floor(d / 365); return `${y} year${y > 1 ? "s" : ""} ago`;
};
const bars = (id: number) => Array.from({ length: 90 }, (_, i) => 25 + Math.abs(Math.sin(id * 0.001 + i * 1.7) * 50 + Math.sin(i * 0.37 + id) * 25));

async function load(q: string): Promise<{ tracks: Track[]; error?: string }> {
  try {
    const r = await fetch(`/api/public/soundcloud?q=${encodeURIComponent(q)}&_t=${Date.now()}`, { cache: "no-store" });
    const d = JSON.parse(await r.text()) as { success: boolean; tracks?: Track[]; error?: string };
    return d.success ? { tracks: d.tracks ?? [] } : { tracks: [], error: d.error ?? "SoundCloud isn't responding right now." };
  } catch { return { tracks: [] }; }
}

export function MusicTab() {
  const [query, setQuery] = useState("");
  const [heading, setHeading] = useState("Trending on SoundCloud");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loop, setLoop] = useState<Loop>("off");
  const frame = useRef<HTMLIFrameElement>(null);
  const widget = useRef<Widget | null>(null);
  const state = useRef({ loop, tracks, current });
  state.current = { loop, tracks, current };

  const run = async (q: string, label: string) => {
    setBusy(true); setError(null); setHeading(label);
    const r = await load(q);
    setTracks(r.tracks);
    if (!r.tracks.length) setError(r.error ?? "No songs found.");
    setBusy(false);
  };
  useEffect(() => { void run("", "Trending on SoundCloud"); }, []);

  useEffect(() => {
    if (window.SC) return;
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    document.body.appendChild(s);
  }, []);

  const onFrameLoad = () => {
    const SC = window.SC; if (!SC || !frame.current) return;
    const w = SC.Widget(frame.current); widget.current = w;
    w.bind(SC.Widget.Events.READY, () => w.play());
    w.bind(SC.Widget.Events.PLAY, () => setPlaying(true));
    w.bind(SC.Widget.Events.PAUSE, () => setPlaying(false));
    w.bind(SC.Widget.Events.PLAY_PROGRESS, (d) => setProgress(d?.relativePosition ?? 0));
    w.bind(SC.Widget.Events.FINISH, () => {
      const { loop: l, tracks: list, current: c } = state.current;
      if (l === "one") { w.seekTo(0); w.play(); return; }
      const i = list.findIndex((t) => t.id === c?.id);
      const next = list[i + 1] ?? (l === "all" ? list[0] : undefined);
      if (next) setCurrent(next); else setPlaying(false);
    });
  };

  const pick = (t: Track) => {
    if (current?.id === t.id && widget.current) { playing ? widget.current.pause() : widget.current.play(); return; }
    setProgress(0); setCurrent(t);
  };
  const nextLoop = () => setLoop((l) => (l === "off" ? "all" : l === "all" ? "one" : "off"));
  const LoopIcon = loop === "one" ? Repeat1 : Repeat;
  const lead = tracks[0];
  const artists = [...new Map(tracks.map((t) => [t.artist, t])).values()].slice(0, 3);
  const tabs = ["Everything", "Tracks", "People", "Albums", "Playlists"];

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}>
      <header className="flex shrink-0 flex-wrap items-center gap-4 px-6 py-3" style={{ borderBottom: "1px solid var(--rd-line)" }}>
        <span className="flex items-center gap-2 text-lg font-bold tracking-[0.12em]">
          <span className="flex items-end gap-[2px]">{[6, 9, 12, 15, 12, 18].map((h, i) => <span key={i} className="w-[2px]" style={{ height: h, background: "var(--rd-text)" }} />)}</span>
          SOUNDCLOUD
        </span>
        <nav className="hidden gap-5 text-sm font-semibold md:flex" style={{ color: "var(--rd-muted)" }}>
          {["Home", "Feed", "Library"].map((n) => <button key={n} onClick={() => n === "Home" && run("", "Trending on SoundCloud")}>{n}</button>)}
        </nav>
        <form className="flex min-w-[180px] flex-1 items-center rounded px-3 py-2" style={{ background: "var(--rd-surface)" }}
          onSubmit={(e) => { e.preventDefault(); const q = query.trim(); if (q) void run(q, `Search results for “${q}”`); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search SoundCloud" className="flex-1 bg-transparent text-sm outline-none" />
          <button type="submit" aria-label="Search"><Search size={18} style={{ color: "var(--rd-accent)" }} /></button>
        </form>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-2xl font-bold">{heading}</h1>
          <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
            <aside>
              <ul className="space-y-1 text-sm font-semibold">
                {tabs.map((t, i) => (
                  <li key={t} className="rounded px-3 py-2" style={i === 0 ? { background: "var(--rd-text)", color: "var(--rd-bg)" } : undefined}>{t}</li>
                ))}
              </ul>
              <p className="mt-10 text-xs leading-6" style={{ color: "var(--rd-muted)" }}>Legal · Privacy · Cookie Policy · Imprint · Artist Resources · Charts</p>
              <p className="mt-4 text-xs">Language: <span style={{ color: "var(--rd-accent)" }}>English (US)</span></p>
            </aside>

            <section>
              {!busy && tracks.length > 0 && <p className="mb-6 text-sm font-semibold" style={{ color: "var(--rd-muted)" }}>Found {tracks.length} tracks</p>}
              {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
              {busy && Array.from({ length: 4 }, (_, i) => <div key={i} className="mb-6 h-40 animate-pulse rounded" style={{ background: "var(--rd-surface)" }} />)}

              {!busy && tracks.map((t, idx) => {
                const active = current?.id === t.id;
                const prog = active ? progress : 0;
                return (
                  <div key={t.id}>
                    <article className="mb-8 flex gap-5">
                      <div className="h-36 w-36 shrink-0 overflow-hidden" style={{ background: "var(--rd-surface)" }}>
                        {t.artwork && <img src={t.artwork} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <button onClick={() => pick(t)} aria-label={active && playing ? "Pause" : "Play"}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--rd-text)", color: "var(--rd-bg)" }}>
                            {active && playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm" style={{ color: "var(--rd-muted)" }}>{t.artist}</div>
                            <div className="line-clamp-2 font-semibold">{t.title}</div>
                          </div>
                          <div className="hidden shrink-0 flex-col items-end gap-1 text-xs sm:flex" style={{ color: "var(--rd-muted)" }}>
                            <span>{ago(t.created)}</span>
                            {t.genre && <span className="rounded-full px-2 py-1" style={{ background: "var(--rd-surface)", color: "var(--rd-text)" }}># {t.genre}</span>}
                          </div>
                        </div>
                        <button className="relative mt-3 flex h-14 w-full items-end gap-[2px]" aria-label="Seek"
                          onClick={(e) => {
                            if (!active || !widget.current) return pick(t);
                            const r = e.currentTarget.getBoundingClientRect();
                            widget.current.seekTo(((e.clientX - r.left) / r.width) * t.duration);
                          }}>
                          {bars(t.id).map((h, i, a) => (
                            <span key={i} className="flex-1" style={{ height: `${h}%`, background: i / a.length < prog ? "var(--rd-accent)" : "var(--rd-muted)", opacity: i / a.length < prog ? 1 : 0.55 }} />
                          ))}
                          <span className="absolute right-0 bottom-1 px-1 text-[10px]" style={{ background: "var(--rd-bg)" }}>{time(t.duration)}</span>
                        </button>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {[Heart, Repeat2, Share, Copy, MoreHorizontal].map((I, i) => (
                            <span key={i} className="flex h-8 w-9 items-center justify-center rounded" style={{ background: "var(--rd-surface)" }}><I size={14} /></span>
                          ))}
                          <span className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--rd-muted)" }}>
                            <span className="flex items-center gap-1"><Play size={11} fill="currentColor" />{fmt(t.plays)}</span>
                            <span className="flex items-center gap-1"><MessageSquare size={11} />{fmt(t.comments)}</span>
                          </span>
                        </div>
                      </div>
                    </article>
                    {idx === 0 && lead && artists.map((a) => (
                      <div key={a.artist} className="mb-8 flex items-center gap-5">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full" style={{ background: "var(--rd-surface)" }}>
                          {a.artwork && <img src={a.artwork} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                        </div>
                        <div className="flex-1 font-semibold"><span className="flex items-center gap-1">{a.artist}<BadgeCheck size={16} style={{ color: "var(--rd-accent)" }} /></span></div>
                        <span className="rounded px-4 py-2 text-sm font-semibold" style={{ background: "var(--rd-text)", color: "var(--rd-bg)" }}>Follow</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          </div>
        </div>
      </div>

      {current && (
        <div className="flex shrink-0 items-center gap-3 px-4 py-2" style={{ background: "var(--rd-surface)", borderTop: "1px solid var(--rd-line)" }}>
          <button onClick={() => (playing ? widget.current?.pause() : widget.current?.play())} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={nextLoop} aria-label={`Repeat: ${loop}`} title={`Repeat: ${loop === "off" ? "off" : loop === "all" ? "all songs" : "this song"}`}
            style={{ color: loop === "off" ? "var(--rd-muted)" : "var(--rd-accent)" }}>
            <LoopIcon size={18} />
          </button>
          {current.artwork && <img src={current.artwork} alt="" className="h-8 w-8 object-cover" referrerPolicy="no-referrer" />}
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate" style={{ color: "var(--rd-muted)" }}>{current.artist}</div>
            <div className="truncate">{current.title}</div>
          </div>
          <iframe ref={frame} key={current.id} title="SoundCloud player" onLoad={onFrameLoad} allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(current.url)}&auto_play=true&visual=false&hide_related=true&show_comments=false`}
            className="h-0 w-0 border-0 opacity-0" />
        </div>
      )}
    </div>
  );
}
