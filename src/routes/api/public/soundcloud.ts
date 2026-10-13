import { createFileRoute } from "@tanstack/react-router";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
let clientId: string | null = null;

async function getClientId(force = false): Promise<string> {
  if (clientId && !force) return clientId;
  const html = await (await fetch("https://soundcloud.com/", { headers: { "user-agent": UA } })).text();
  const inline = html.match(/client_id["':=\s]+([a-zA-Z0-9]{32})/);
  if (inline?.[1]) return (clientId = inline[1]);
  const scripts = [...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1] as string).reverse();
  for (const src of scripts) {
    const js = await (await fetch(src, { headers: { "user-agent": UA } })).text();
    const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"/);
    if (m?.[1]) return (clientId = m[1]);
  }
  throw new Error("no client id");
}

type Raw = { id: number; title: string; permalink_url: string; artwork_url?: string | null; duration: number; playback_count?: number; likes_count?: number; comment_count?: number; genre?: string | null; created_at?: string; user?: { username?: string; avatar_url?: string } };

async function api(path: string, retry = true): Promise<unknown> {
  const id = await getClientId(!retry);
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://api-v2.soundcloud.com${path}${sep}client_id=${id}`, { headers: { "user-agent": UA, accept: "application/json" } });
  if ((r.status === 401 || r.status === 403) && retry) return api(path, false);
  if (!r.ok) throw new Error(`SoundCloud ${r.status}`);
  return r.json();
}

const shape = (t: Raw) => ({
  id: t.id,
  title: t.title,
  url: t.permalink_url,
  artist: t.user?.username ?? "",
  artwork: (t.artwork_url ?? t.user?.avatar_url ?? "").replace("-large", "-t500x500") || null,
  duration: t.duration,
  plays: t.playback_count ?? null,
  likes: t.likes_count ?? null,
  comments: t.comment_count ?? null,
  genre: t.genre || null,
  created: t.created_at ?? null,
});

const json = (d: unknown) => new Response(JSON.stringify(d), { headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const Route = createFileRoute("/api/public/soundcloud")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200);
        try {
          if (q) {
            const d = (await api(`/search/tracks?q=${encodeURIComponent(q)}&limit=40`)) as { collection?: Raw[] };
            return json({ success: true, tracks: (d.collection ?? []).filter((t) => t?.id).map(shape) });
          }
          const d = (await api(`/charts?kind=top&genre=soundcloud:genres:all-music&limit=40`).catch(() => null)) as { collection?: { track: Raw }[] } | null;
          let tracks = (d?.collection ?? []).map((c) => c.track).filter((t) => t?.id).map(shape);
          if (!tracks.length) {
            const s = (await api(`/search/tracks?q=top%20hits&limit=40`)) as { collection?: Raw[] };
            tracks = (s.collection ?? []).filter((t) => t?.id).map(shape);
          }
          return json({ success: true, tracks });
        } catch {
          return json({ success: false, error: "SoundCloud isn't responding right now." });
        }
      },
    },
  },
});
