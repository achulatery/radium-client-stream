/** Client helpers for the Invidious API, routed through our CORS-safe proxy. */
const BASE = "/api/public/invidious";

export type InvidiousVideo = {
  videoId: string | null;
  title: string;
  author: string;
  authorId: string | null;
  viewCount: number | null;
  published: number | null;
  publishedText: string | null;
  lengthSeconds: number | null;
  liveNow: boolean;
  thumbnail: string | null;
  description: string | null;
  likeCount?: number | null;
  genre?: string | null;
  embedUrl?: string | null;
  streams?: { url: string; quality: string; type: string | null }[];
};

export type InvidiousComment = {
  commentId: string | null;
  author: string;
  authorAvatar: string | null;
  content: string;
  published: number | null;
  publishedText: string | null;
  likeCount: number;
  replyCount: number;
};

type Fail = { success: false; error: string; details?: string[] };

async function call<T>(params: Record<string, string | number | undefined>): Promise<T | Fail> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  try {
    const res = await fetch(`${BASE}?${qs.toString()}`);
    const data = (await res.json().catch(() => null)) as T | Fail | null;
    if (!res.ok || !data) {
      return {
        success: false,
        error: (data as Fail | null)?.error ?? `Request failed (${res.status})`,
      };
    }
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

export function searchVideos(query: string, options?: { page?: number; region?: string }) {
  return call<{ success: true; instance: string; results: InvidiousVideo[] }>({
    action: "search",
    q: query,
    page: options?.page,
    region: options?.region,
  });
}

export function getTrending(options?: { region?: string }) {
  return call<{ success: true; instance: string; results: InvidiousVideo[] }>({
    action: "trending",
    region: options?.region,
  });
}

export function getVideo(videoId: string, options?: { region?: string }) {
  return call<{ success: true; instance: string; video: InvidiousVideo }>({
    action: "video",
    id: videoId,
    region: options?.region,
  });
}

export function getComments(videoId: string, options?: { continuation?: string }) {
  return call<{
    success: true;
    instance: string;
    commentCount: number | null;
    continuation: string | null;
    comments: InvidiousComment[];
  }>({ action: "comments", id: videoId, continuation: options?.continuation });
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatViews(n: number | null): string {
  if (n == null) return "";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B views`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}
