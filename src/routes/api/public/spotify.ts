import { createFileRoute } from "@tanstack/react-router";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const json = (d: unknown) => new Response(JSON.stringify(d), { headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function findIds(q: string): Promise<string[]> {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:open.spotify.com/track ${q}`)}`, { headers: { "user-agent": UA } });
  const html = await r.text();
  return [...new Set([...html.matchAll(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/g)].map((m) => m[1] as string))].slice(0, 15);
}

async function info(id: string) {
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`, { headers: { "user-agent": UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as { title?: string; thumbnail_url?: string };
    return { id, title: d.title ?? "Unknown song", artwork: d.thumbnail_url ?? null };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/spotify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200) || "top hits 2026";
        try {
          const ids = await findIds(q);
          const tracks = (await Promise.all(ids.map(info))).filter(Boolean);
          return json({ success: true, tracks });
        } catch {
          return json({ success: false, error: "Spotify isn't responding right now." });
        }
      },
    },
  },
});
