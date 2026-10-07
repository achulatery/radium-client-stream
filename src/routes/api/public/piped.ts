import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Public Piped API instances; the first is preferred, the rest are automatic fallbacks. */
const INSTANCES = [
  "https://pipedapi.ducks.party",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.darkness.services",
  "https://api.piped.private.coffee",
  "https://pipedapi.ducks.party",
  "https://pipedapi.moomoo.me",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.leptons.xyz",
];

const TIMEOUT_MS = 3_500;
let lastGood: string | null = null;

const schema = z.object({
  action: z.enum(["search", "streams", "trending", "more"]),
  nextpage: z.string().max(4000).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  id: z.string().trim().regex(/^[\w-]{6,20}$/).optional(),
  region: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, max-age=0", ...CORS },
  });

async function tryInstance(base: string, path: string) {
  const res = await fetch(base + path, {
    headers: { accept: "application/json", "user-agent": "RadiumClient/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("json")) throw new Error("Not JSON");
  const data = (await res.json()) as { error?: string };
  if (data && typeof data === "object" && "error" in data && data.error) throw new Error(String(data.error));
  return { data: data as unknown, instance: base };
}

async function fetchPiped(path: string) {
  const errors: string[] = [];
  const order = lastGood ? [lastGood, ...INSTANCES.filter((i) => i !== lastGood)] : INSTANCES;
  try {
    const win = await Promise.any(
      order.map((b) =>
        tryInstance(b, path).catch((e: unknown) => {
          errors.push(`${b}: ${e instanceof Error ? e.message : "failed"}`);
          throw e;
        }),
      ),
    );
    lastGood = win.instance;
    return { ...win, errors };
  } catch {
    return { data: null, instance: null, errors };
  }
}

type RawItem = {
  url?: string;
  type?: string;
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploadedDate?: string;
  duration?: number;
  views?: number;
};

const idFromUrl = (u?: string) => u?.match(/[?&]v=([\w-]{6,20})/)?.[1] ?? null;

function shapeItem(v: RawItem) {
  const id = idFromUrl(v.url);
  return {
    videoId: id,
    title: v.title ?? "",
    author: v.uploaderName ?? "",
    views: v.views ?? null,
    uploaded: v.uploadedDate ?? null,
    duration: v.duration ?? null,
    thumbnail: v.thumbnail ?? (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null),
  };
}

type RawStream = { url?: string; quality?: string; mimeType?: string; videoOnly?: boolean; height?: number };

export const Route = createFileRoute("/api/public/piped")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          return await handle(request);
        } catch (e) {
          console.error("Piped route error", e);
          return json({ success: false, error: "Piped had a problem. Please try again." });
        }
      },
    },
  },
});

async function handle(request: Request): Promise<Response> {
        const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
        if (!parsed.success) return json({ success: false, error: "Invalid parameters" }, 400);
        const p = parsed.data;
        if (((p.action === "search" || p.action === "more") && !p.q) || (p.action === "more" && !p.nextpage) || (p.action === "streams" && !p.id)) {
          return json({ success: false, error: "Missing parameter" }, 400);
        }
        const region = (p.region ?? "SG").toUpperCase();
        const path =
          p.action === "more"
            ? `/nextpage/search?nextpage=${encodeURIComponent(p.nextpage!)}&q=${encodeURIComponent(p.q!)}&filter=videos`
            : p.action === "search"
            ? `/search?q=${encodeURIComponent(p.q!)}&filter=videos`
            : p.action === "trending"
              ? `/trending?region=${region}`
              : `/streams/${p.id}`;

        const { data, instance, errors } = await fetchPiped(path);
        if (!data) {
          console.error(`Piped upstream failed: ${errors.join(" | ")}`);
          return json({ success: false, error: "No Piped instance responded", details: errors });
        }

        if (p.action === "streams") {
          const d = data as {
            title?: string;
            uploader?: string;
            views?: number;
            duration?: number;
            description?: string;
            thumbnailUrl?: string;
            hls?: string;
            videoStreams?: RawStream[];
          };
          const streams = (d.videoStreams ?? [])
            .filter((s) => s.url && !s.videoOnly && !/hls/i.test(s.quality ?? ""))
            .map((s) => ({ url: s.url!, quality: s.quality ?? `${s.height ?? "?"}p`, mimeType: s.mimeType ?? "" }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
          return json({
            success: true,
            instance,
            video: {
              videoId: p.id,
              title: d.title ?? "",
              author: d.uploader ?? "",
              views: d.views ?? null,
              duration: d.duration ?? null,
              description: d.description ?? "",
              thumbnail: d.thumbnailUrl ?? `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`,
              hls: d.hls ?? null,
              streams,
            },
          });
        }

        const list = Array.isArray(data)
          ? (data as RawItem[])
          : ((data as { items?: RawItem[] }).items ?? []);
        return json({
          success: true,
          instance,
          nextpage: Array.isArray(data) ? null : ((data as { nextpage?: string | null }).nextpage ?? null),
          results: list.filter((v) => (v.type ?? "stream") === "stream").map(shapeItem).filter((v) => v.videoId),
        });
}
