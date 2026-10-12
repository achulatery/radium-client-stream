import { useEffect, useState } from "react";
import { Play, Search } from "lucide-react";

type Track = { id: string; title: string; artwork: string | null };

/* Spotify's own look: near-black surfaces with Spotify green. */
const S = { bg: "#121212", card: "#181818", hover: "#282828", green: "#1db954", text: "#ffffff", muted: "#b3b3b3" };

async function load(q: string): Promise<{ tracks: Track[]; error?: string }> {
  try {
    const r = await fetch(`/api/public/spotify?q=${encodeURIComponent(q)}&_t=${Date.now()}`, { cache: "no-store" });
    const d = JSON.parse(await r.text()) as { success: boolean; tracks?: Track[]; error?: string };
    return d.success ? { tracks: d.tracks ?? [] } : { tracks: [], error: d.error ?? "Spotify isn't responding right now." };
  } catch {
    return { tracks: [], error: "Spotify isn't responding right now." };
  }
}

export function SpotifyView() {
  const [query, setQuery] = useState("");
  const [heading, setHeading] = useState("Today's top hits");
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
  useEffect(() => { void run("", "Today's top hits"); }, []);

  return (
    <div className="h-full overflow-y-auto" style={{ background: S.bg, color: S.text, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div className="mx-auto max-w-5xl px-4 pb-6 pt-4" style={{ paddingBottom: open ? 110 : 24 }}>
        <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) void run(query.trim(), `Songs for “${query.trim()}”`); }}
          className="flex max-w-md items-center gap-2 rounded-full px-4 py-3" style={{ background: "#242424", color: S.text }}>
          <Search size={18} style={{ color: S.muted }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you want to play?" className="flex-1 bg-transparent text-sm outline-none" />
        </form>

        <h2 className="mt-6 mb-4 text-2xl font-bold">{heading}</h2>
        {error && <p className="text-sm" style={{ color: S.muted }}>{error}</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {busy
            ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-md" style={{ background: S.card }} />)
            : tracks.map((t) => (
                <button key={t.id} onClick={() => setOpen(t)} className="group rounded-md p-3 text-left transition-colors"
                  style={{ background: open?.id === t.id ? S.hover : S.card }}>
                  <div className="relative aspect-square overflow-hidden rounded-md" style={{ background: S.hover }}>
                    {t.artwork && <img src={t.artwork} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                    <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                      style={{ background: S.green, color: "#000" }}><Play size={18} fill="#000" /></span>
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm font-semibold">{t.title}</div>
                  <div className="mt-1 text-xs" style={{ color: S.muted }}>Song</div>
                </button>
              ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-2" style={{ background: "#000" }}>
          <iframe key={open.id} title={open.title} src={`https://open.spotify.com/embed/track/${open.id}?utm_source=generator&theme=0&autoplay=1`}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="h-[80px] w-full rounded-xl border-0" />
        </div>
      )}
    </div>
  );
}
