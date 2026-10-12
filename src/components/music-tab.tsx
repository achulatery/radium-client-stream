import { useEffect, useState } from "react";
import { Headphones, Heart, Play, Search } from "lucide-react";

type Track = { id: number; title: string; url: string; artist: string; artwork: string | null; duration: number; plays: number | null; likes: number | null };

const fmt = (n: number | null) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
const time = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

async function load(q: string): Promise<{ tracks: Track[]; error?: string }> {
  try {
    const r = await fetch(`/api/public/soundcloud?q=${encodeURIComponent(q)}&_t=${Date.now()}`, { cache: "no-store" });
    const d = JSON.parse(await r.text()) as { success: boolean; tracks?: Track[]; error?: string };
    return d.success ? { tracks: d.tracks ?? [] } : { tracks: [], error: d.error ?? "SoundCloud isn't responding right now." };
  } catch {
    return { tracks: [], error: "SoundCloud isn't responding right now." };
  }
}

/** SoundCloud-style music tab. Songs play inside Radium via SoundCloud's official player. */
export function SoundCloudView() {
  const [query, setQuery] = useState("");
  const [heading, setHeading] = useState("Trending on SoundCloud");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Track | null>(null);

  const run = async (q: string, label: string) => {
    setBusy(true); setError(null); setHeading(label);
    const r = await load(q);
    setTracks(r.tracks);
    if (!r.tracks.length) setError(r.error ?? "No songs found.");
    setBusy(false);
  };

  useEffect(() => { void run("", "Trending on SoundCloud"); }, []);

  const accent = "var(--rd-accent)".length ? "" : "";
  const color = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--rd-accent").trim().replace("#", "") : "19d3d1";
  const playerSrc = open
    ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(open.url)}&color=%23${color || "19d3d1"}&auto_play=true&hide_related=true&show_comments=true&show_user=true&show_reposts=false&visual=false${accent}`
    : "";

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <form
          onSubmit={(e) => { e.preventDefault(); if (query.trim()) void run(query.trim(), `Results for “${query.trim()}”`); }}
          className="flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }}
        >
          <Search size={16} style={{ color: "var(--rd-accent)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SoundCloud tracks or artists" className="flex-1 bg-transparent text-sm outline-none" />
        </form>

        {open && (
          <section className="mt-6 overflow-hidden rounded-md" style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}>
            <iframe key={open.id} title={open.title} src={playerSrc} allow="autoplay" className="h-[166px] w-full border-0" />
          </section>
        )}

        <h2 className="mt-6 mb-2 text-sm font-semibold" style={{ color: "var(--rd-muted)" }}>{heading}</h2>
        {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}
        <ul>
          {busy
            ? Array.from({ length: 8 }).map((_, i) => <li key={i} className="mb-2 h-16 animate-pulse rounded-sm" style={{ background: "var(--rd-surface)" }} />)
            : tracks.map((t, i) => (
                <li key={t.id}>
                  <button
                    onClick={() => setOpen(t)}
                    className="group flex w-full items-center gap-3 px-2 py-2 text-left"
                    style={{ background: open?.id === t.id ? "var(--rd-surface)" : "transparent", borderBottom: "1px solid var(--rd-line)" }}
                  >
                    <span className="w-6 text-right font-mono text-xs" style={{ color: "var(--rd-muted)" }}>{i + 1}</span>
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm" style={{ background: "var(--rd-line)" }}>
                      {t.artwork && <img src={t.artwork} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100" style={{ background: "rgba(0,0,0,.4)" }}>
                        <Play size={18} style={{ color: "var(--rd-accent)" }} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs" style={{ color: "var(--rd-muted)" }}>{t.artist}</div>
                      <div className="truncate text-sm">{t.title}</div>
                    </div>
                    <span className="hidden items-center gap-1 text-xs sm:flex" style={{ color: "var(--rd-muted)" }}><Heart size={12} />{fmt(t.likes)}</span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--rd-muted)" }}><Headphones size={12} style={{ color: "var(--rd-accent)" }} />{fmt(t.plays)}</span>
                    <span className="w-10 text-right font-mono text-xs" style={{ color: "var(--rd-muted)" }}>{time(t.duration)}</span>
                  </button>
                </li>
              ))}
        </ul>
      </div>
    </div>
  );
}

import { SpotifyView } from "@/components/spotify-view";

/** Music tab with an Options button to switch between SoundCloud and Spotify. */
export function MusicTab() {
  const [service, setService] = useState<"soundcloud" | "spotify">("soundcloud");
  const [menu, setMenu] = useState(false);
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "var(--rd-bg)", borderBottom: "1px solid var(--rd-line)", color: "var(--rd-text)" }}>
        <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--rd-accent)" }}>
          {service === "spotify" ? "CONNECTED TO SPOTIFY" : "CONNECTED TO SOUNDCLOUD"}
        </span>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="rounded-full px-3 py-1 text-xs" style={{ border: "1px solid var(--rd-line)", background: "var(--rd-surface)" }}>Options</button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md text-sm" style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}>
              {(["soundcloud", "spotify"] as const).map((s) => (
                <button key={s} onClick={() => { setService(s); setMenu(false); }} className="block w-full px-3 py-2 text-left" style={{ color: service === s ? "var(--rd-accent)" : "var(--rd-text)" }}>
                  {s === "spotify" ? "Spotify" : "SoundCloud"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">{service === "spotify" ? <SpotifyView /> : <SoundCloudView />}</div>
    </div>
  );
}
