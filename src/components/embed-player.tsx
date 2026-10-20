import { createContext, useContext, useEffect, useState } from "react";
import { preloadVideo } from "@/lib/video-loading";
import { setupUltraviolet, uvUrl } from "@/lib/ultraviolet";
import { useRadium } from "@/lib/radium";

export const INVIDIOUS_EMBEDS = [
  "yewtu.be",
  "inv.nadeko.net",
  "invidious.nerdvpn.de",
  "iv.ggtyler.dev",
  "invidious.f5.si",
  "invidious.jing.rocks",
];
export const PIPED_EMBEDS = ["piped.video", "cf.piped.video", "piped.mha.fi", "piped.lunar.icu"];

/** Plays a video through a third-party embed loaded via Ultraviolet, cycling mirrors when one fails. */
export function EmbedPlayer({ videoId, title, hosts }: { videoId: string; title: string; hosts: string[] }) {
  const { settings } = useRadium();
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [proxy, setProxy] = useState<"pending" | "on" | "off">("pending");
  useEffect(() => {
    let live = true;
    void setupUltraviolet(settings.wispServer).then((r) => { if (live) setProxy(r.ok ? "on" : "off"); });
    return () => { live = false; };
  }, [settings.wispServer]);
  useEffect(() => { setIndex(0); setLoaded(false); }, [videoId]);
  useEffect(() => {
    if (loaded || proxy === "pending") return;
    const t = setTimeout(() => setIndex((i) => (i + 1 < hosts.length ? i + 1 : i)), 15000);
    return () => clearTimeout(t);
  }, [index, loaded, hosts.length, videoId, proxy]);
  const host = hosts[index];
  const target = `https://${host}/embed/${videoId}?autoplay=1`;
  const next = () => { setLoaded(false); setIndex((i) => (i + 1) % hosts.length); };
  const btn = { background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" };
  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-md aspect-video" style={{ background: "var(--rd-surface)" }}>
        {proxy === "pending" ? (
          <div className="flex h-full items-center justify-center font-mono text-[11px] animate-pulse" style={{ color: "var(--rd-muted)" }}>Connecting…</div>
        ) : (
          <iframe
            key={`${proxy}-${host}-${videoId}`}
            src={proxy === "on" ? uvUrl(target) : target}
            title={title}
            className="h-full w-full"
            style={{ border: "none" }}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
            onError={next}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>MIRROR</span>
        <select value={index} onChange={(e) => { setLoaded(false); setIndex(Number(e.target.value)); }} className="rounded px-2 py-1 text-xs" style={btn}>
          {hosts.map((h, i) => <option key={h} value={i}>{h}</option>)}
        </select>
        <button onClick={next} className="rounded px-2 py-1 text-xs" style={btn}>Try next mirror</button>
        {proxy === "off" && <span className="font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>Proxy unavailable — loading directly</span>}
      </div>
    </div>
  );
}

/** Old direct player: streams the video file through Radium, falling back to mirrors on failure. */
export function DirectPlayer({ videoId, title, hosts, streams, poster }: { videoId: string; title: string; hosts: string[]; streams: { url: string; quality: string }[] | null; poster?: string | null }) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [videoId, streams]);
  if (streams === null) return <div className="flex w-full items-center justify-center rounded-md aspect-video animate-pulse font-mono text-[11px]" style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}>Finding a stream…</div>;
  const s = streams[i];
  if (!s) return <EmbedPlayer videoId={videoId} title={title} hosts={hosts} />;
  return (
    <video key={s.url} src={`/api/stream?url=${encodeURIComponent(s.url)}`} poster={poster ?? undefined} controls autoPlay playsInline preload="auto"
      className="w-full rounded-md aspect-video" style={{ background: "var(--rd-surface)" }} onError={() => setI((n) => n + 1)} />
  );
}

export const PlayerModeContext = createContext<"mirror" | "direct">("mirror");

/** Picks the owner-chosen player for everyone. */
export function VideoPlayer({ videoId, title, hosts, poster }: { videoId: string; title: string; hosts: string[]; poster?: string | null }) {
  const mode = useContext(PlayerModeContext);
  const [streams, setStreams] = useState<{ url: string; quality: string }[] | null>(null);
  useEffect(() => {
    if (mode !== "direct" || !videoId) return;
    let live = true;
    setStreams(null);
    void preloadVideo(videoId).then((s) => { if (live) setStreams(s ?? []); });
    return () => { live = false; };
  }, [mode, videoId]);
  if (mode === "direct") return <DirectPlayer videoId={videoId} title={title} hosts={hosts} streams={streams} poster={poster} />;
  return <EmbedPlayer videoId={videoId} title={title} hosts={hosts} />;
}
