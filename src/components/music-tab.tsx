import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Search } from "lucide-react";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { pipedSearch, pipedStreams, type PipedItem, type PipedVideo } from "@/lib/piped";
import { formatViews, searchVideos } from "@/lib/invidious";

/** SoundCloud-style music list. Only song info loads up front; the music video loads when a song is opened. */
async function findSongs(q: string): Promise<PipedItem[]> {
  const r = await pipedSearch(q);
  if (r.success && r.results.length) return r.results;
  const alt = await searchVideos(q, { region: "SG" });
  if (alt.success) {
    return alt.results.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      author: v.author,
      views: v.viewCount ?? null,
      uploaded: v.publishedText ?? null,
      duration: v.lengthSeconds ?? null,
      thumbnail: null,
    }));
  }
  return [];
}

export function MusicTab() {
  const [query, setQuery] = useState("");
  const [heading, setHeading] = useState("Popular songs");
  const [songs, setSongs] = useState<PipedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<PipedItem | null>(null);
  const [video, setVideo] = useState<PipedVideo | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLVideoElement>(null);

  const run = async (q: string, label: string) => {
    setBusy(true);
    setError(null);
    setHeading(label);
    const list = await findSongs(q);
    setSongs(list);
    if (!list.length) setError("No songs found. Try again in a moment.");
    setBusy(false);
  };

  useEffect(() => {
    void run("top hits music 2026", "Popular songs");
  }, []);

  const openSong = async (s: PipedItem) => {
    setOpen(s);
    setVideo(null);
    setPlaying(false);
    setLoadingVideo(true);
    const r = await pipedStreams(s.videoId);
    setVideo(r.success && r.video.streams.length ? r.video : null);
    setLoadingVideo(false);
  };

  const stream = video?.streams[0]?.url;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) void run(`${query.trim()} song`, `Results for “${query.trim()}”`);
          }}
          className="flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }}
        >
          <Search size={16} style={{ color: "var(--rd-accent)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs or artists"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </form>

        {open && (
          <section className="mt-6 overflow-hidden rounded-md" style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}>
            <div className="flex items-center gap-4 p-4">
              <div className="w-28 shrink-0 overflow-hidden rounded-sm"><VideoThumbnail videoId={open.videoId} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs" style={{ color: "var(--rd-muted)" }}>{open.author}</div>
                <div className="truncate font-semibold">{open.title}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--rd-muted)" }}>
                  {open.views != null ? `${formatViews(open.views)} listens` : ""}
                </div>
              </div>
              <button
                disabled={!stream}
                onClick={() => {
                  const v = player.current;
                  if (!v) return;
                  if (v.paused) void v.play(); else v.pause();
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40"
                style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
                aria-label={playing ? "Pause" : "Play music video"}
              >
                {playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
            </div>
            {loadingVideo && <div className="animate-pulse px-4 pb-4 text-xs" style={{ color: "var(--rd-muted)" }}>Preparing the music video…</div>}
            {!loadingVideo && !stream && <div className="px-4 pb-4 text-xs" style={{ color: "var(--rd-muted)" }}>This music video isn't available right now.</div>}
            {stream && (
              <video
                ref={player}
                src={`/api/stream?url=${encodeURIComponent(stream)}`}
                preload="auto"
                controls
                playsInline
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="aspect-video w-full bg-black"
              />
            )}
          </section>
        )}

        <h2 className="mt-6 mb-2 text-sm font-semibold" style={{ color: "var(--rd-muted)" }}>{heading}</h2>
        {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}
        <ul>
          {busy && !songs.length
            ? Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="mb-2 h-16 animate-pulse rounded-sm" style={{ background: "var(--rd-surface)" }} />
              ))
            : songs.map((s, i) => (
                <li key={s.videoId}>
                  <button
                    onClick={() => void openSong(s)}
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors"
                    style={{
                      background: open?.videoId === s.videoId ? "var(--rd-surface)" : "transparent",
                      borderBottom: "1px solid var(--rd-line)",
                    }}
                  >
                    <span className="w-6 text-right font-mono text-xs" style={{ color: "var(--rd-muted)" }}>{i + 1}</span>
                    <div className="w-20 shrink-0 overflow-hidden rounded-sm"><VideoThumbnail videoId={s.videoId} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs" style={{ color: "var(--rd-muted)" }}>{s.author}</div>
                      <div className="truncate text-sm">{s.title}</div>
                    </div>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--rd-muted)" }}>
                      <Headphones size={12} style={{ color: "var(--rd-accent)" }} />
                      {s.views != null ? formatViews(s.views) : "—"}
                    </span>
                  </button>
                </li>
              ))}
        </ul>
      </div>
    </div>
  );
}
