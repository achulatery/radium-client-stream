import { useEffect, useState } from "react";

export const INVIDIOUS_EMBEDS = [
  "yewtu.be",
  "inv.nadeko.net",
  "invidious.nerdvpn.de",
  "iv.ggtyler.dev",
  "invidious.f5.si",
  "invidious.jing.rocks",
];
export const PIPED_EMBEDS = ["piped.video", "cf.piped.video", "piped.mha.fi", "piped.lunar.icu"];

/** Plays a video through a third-party embed, cycling mirrors when one fails to load. */
export function EmbedPlayer({ videoId, title, hosts }: { videoId: string; title: string; hosts: string[] }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setIndex(0); setLoaded(false); }, [videoId]);
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setIndex((i) => (i + 1 < hosts.length ? i + 1 : i)), 12000);
    return () => clearTimeout(t);
  }, [index, loaded, hosts.length, videoId]);
  const host = hosts[index];
  const next = () => { setLoaded(false); setIndex((i) => (i + 1) % hosts.length); };
  const btn = { background: "var(--rd-button)", color: "var(--rd-button-text)", border: "1px solid var(--rd-line)" };
  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-md aspect-video" style={{ background: "var(--rd-surface)" }}>
        <iframe
          key={`${host}-${videoId}`}
          src={`https://${host}/embed/${videoId}?autoplay=1`}
          title={title}
          className="h-full w-full"
          style={{ border: "none" }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          onError={next}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px]" style={{ color: "var(--rd-muted)" }}>MIRROR</span>
        <select value={index} onChange={(e) => { setLoaded(false); setIndex(Number(e.target.value)); }} className="rounded px-2 py-1 text-xs" style={btn}>
          {hosts.map((h, i) => <option key={h} value={i}>{h}</option>)}
        </select>
        <button onClick={next} className="rounded px-2 py-1 text-xs" style={btn}>Try next mirror</button>
      </div>
    </div>
  );
}
