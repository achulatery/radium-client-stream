import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Eligibility checks only: never proxies the selected Invidious instance. */
const cache = new Map<string, { allowed: boolean; expires: number }>();
export async function playableWithoutLogin(id: string): Promise<boolean> {
  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) return cached.allowed;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(2500),
    });
    // Transient rate limits/outages are not proof of age restriction.
    if (!res.ok && ![401, 403, 404].includes(res.status)) return true;
    const allowed = res.ok;
    if (cache.size >= 5000) cache.clear();
    cache.set(id, { allowed, expires: Date.now() + 300_000 });
    return allowed;
  } catch { return true; }
}
const schema = z.object({ ids: z.array(z.string().regex(/^[\w-]{6,20}$/)).max(100) });
export const Route = createFileRoute("/api/public/invidious")({
  server: { handlers: {
    POST: async ({ request }) => {
      const parsed = schema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: "Invalid video IDs" }, { status: 400 });
      const checked = await Promise.all([...new Set(parsed.data.ids)].map(async (id) => ({ id, allowed: await playableWithoutLogin(id) })));
      return Response.json({ blocked: checked.filter((v) => !v.allowed).map((v) => v.id) }, { headers: { "cache-control": "no-store" } });
    },
  } },
});
