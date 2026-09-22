import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Lightweight CORS-free proxy for the public Invidious API (api.invidious.io).
 * Public instances only, no authentication. Each action returns structured JSON.
 */
const INSTANCES = [
  "https://invidious.f5.si",
  "https://inv.nadeko.net",
  "https://iv.ggtyler.dev",
  "https://invidious.jing.rocks",
  "https://yewtu.be",
  "https://vid.puffyan.us",
];

const UPSTREAM_TIMEOUT_MS = 12_000;

const paramsSchema = z.object({
  action: z.enum(["search", "video", "comments", "trending"]),
  q: z.string().trim().min(1).max(200).optional(),
  id: z
    .string()
    .trim()
    .regex(/^[\w-]{6,20}$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(20).optional(),
  region: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  continuation: z.string().trim().max(4000).optional(),
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

function upstreamPath(p: z.infer<typeof paramsSchema>): string {
  const region = (p.region ?? "SG").toUpperCase();
  switch (p.action) {
    case "search":
      return `/api/v1/search?q=${encodeURIComponent(p.q ?? "")}&type=video&region=${region}&page=${p.page ?? 1}`;
    case "video":
      return `/api/v1/videos/${p.id}?region=${region}`;
    case "comments":
      return `/api/v1/comments/${p.id}${p.continuation ? `?continuation=${encodeURIComponent(p.continuation)}` : ""}`;
    case "trending":
      return `/api/v1/trending?region=${region}&type=video`;
  }
}

async function fetchFromInstances(path: string) {
  const errors: string[] = [];
  for (const base of INSTANCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(base + path, {
        headers: { accept: "application/json", "user-agent": "RadiumClient/1.0" },
        signal: controller.signal,
        redirect: "follow",
      });
      if (!res.ok) {
        errors.push(`${base} -> ${res.status}`);
        continue;
      }
      const data = (await res.json()) as unknown;
      return { data, instance: base, errors };
    } catch (error) {
      errors.push(`${base} -> ${error instanceof Error ? error.message : "failed"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return { data: null, instance: null, errors };
}

type RawVideo = {
  videoId?: string;
  title?: string;
  author?: string;
  authorId?: string;
  viewCount?: number;
  published?: number;
  publishedText?: string;
  lengthSeconds?: number;
  description?: string;
  descriptionHtml?: string;
  videoThumbnails?: { url?: string; width?: number; height?: number }[];
  liveNow?: boolean;
};

function bestThumb(v: RawVideo): string | null {
  const thumbs = v.videoThumbnails ?? [];
  const pick = thumbs.find((t) => t.width && t.width >= 320) ?? thumbs[0];
  return pick?.url ?? (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` : null);
}

function shapeVideo(v: RawVideo) {
  return {
    videoId: v.videoId ?? null,
    title: v.title ?? "",
    author: v.author ?? "",
    authorId: v.authorId ?? null,
    viewCount: v.viewCount ?? null,
    published: v.published ?? null,
    publishedText: v.publishedText ?? null,
    lengthSeconds: v.lengthSeconds ?? null,
    liveNow: Boolean(v.liveNow),
    thumbnail: bestThumb(v),
    description: v.description ?? null,
  };
}

type RawComment = {
  commentId?: string;
  author?: string;
  authorThumbnails?: { url?: string; width?: number }[];
  content?: string;
  published?: number;
  publishedText?: string;
  likeCount?: number;
  replies?: { replyCount?: number };
};

function shapeComment(c: RawComment) {
  return {
    commentId: c.commentId ?? null,
    author: c.author ?? "",
    authorAvatar: (c.authorThumbnails ?? []).at(-1)?.url ?? null,
    content: c.content ?? "",
    published: c.published ?? null,
    publishedText: c.publishedText ?? null,
    likeCount: c.likeCount ?? 0,
    replyCount: c.replies?.replyCount ?? 0,
  };
}

export const Route = createFileRoute("/api/public/invidious")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = paramsSchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return json({ success: false, error: "Invalid parameters" }, 400);
        }
        const p = parsed.data;
        if ((p.action === "search" && !p.q) || ((p.action === "video" || p.action === "comments") && !p.id)) {
          return json({ success: false, error: `Missing parameter for action "${p.action}"` }, 400);
        }

        const { data, instance, errors } = await fetchFromInstances(upstreamPath(p));
        if (!data) {
          console.error(`Invidious upstream failed: ${errors.join(" | ")}`);
          return json({ success: false, error: "No Invidious instance responded", details: errors }, 502);
        }

        if (p.action === "search" || p.action === "trending") {
          const list = Array.isArray(data) ? (data as RawVideo[]) : [];
          return json({
            success: true,
            instance,
            action: p.action,
            results: list.filter((v) => v.videoId).map(shapeVideo),
          });
        }

        if (p.action === "video") {
          const v = data as RawVideo & { subCountText?: string; likeCount?: number; genre?: string };
          return json({
            success: true,
            instance,
            action: "video",
            video: {
              ...shapeVideo(v),
              likeCount: v.likeCount ?? null,
              genre: v.genre ?? null,
              embedUrl: v.videoId ? `${instance}/embed/${v.videoId}` : null,
            },
          });
        }

        const payload = data as { comments?: RawComment[]; continuation?: string; commentCount?: number };
        return json({
          success: true,
          instance,
          action: "comments",
          commentCount: payload.commentCount ?? null,
          continuation: payload.continuation ?? null,
          comments: (payload.comments ?? []).map(shapeComment),
        });
      },
    },
  },
});
