/** Direct Invidious requests; Radium never relays instance content or media. */
export const INVIDIOUS_INSTANCE = "https://tube.mint.lgbt";
export const invidiousEmbedUrl = (id: string) => `${INVIDIOUS_INSTANCE}/embed/${encodeURIComponent(id)}?autoplay=1&local=true`;
export const invidiousThumbnailUrl = (id: string, size = "hqdefault") => `${INVIDIOUS_INSTANCE}/vi/${encodeURIComponent(id)}/${size}.jpg`;

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

type Fail = { success: false; error: string };
type Raw = Record<string, unknown>;
const record = (value: unknown): value is Raw => Boolean(value && typeof value === "object" && !Array.isArray(value));
const str = (value: unknown) => typeof value === "string" ? value : "";
const num = (value: unknown) => typeof value === "number" ? value : null;

function shapeVideo(v: Raw): InvidiousVideo {
  const videoId = str(v["videoId"]) || null;
  return {
    videoId, title: str(v["title"]), author: str(v["author"]), authorId: str(v["authorId"]) || null,
    viewCount: num(v["viewCount"]), published: num(v["published"]), publishedText: str(v["publishedText"]) || null,
    lengthSeconds: num(v["lengthSeconds"]), liveNow: Boolean(v["liveNow"]),
    thumbnail: videoId ? invidiousThumbnailUrl(videoId) : null,
    description: str(v["description"]) || null,
    embedUrl: videoId ? invidiousEmbedUrl(videoId) : null,
    streams: instanceStreams(v["formatStreams"]),
  };
}

/** Keeps only playable streams served by the instance itself (local=true), never googlevideo.com. */
export function instanceStreams(raw: unknown): { url: string; quality: string; type: string | null }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(record).flatMap((s) => {
    try {
      const u = new URL(str(s["url"]), INVIDIOUS_INSTANCE);
      if (u.hostname !== new URL(INVIDIOUS_INSTANCE).hostname || !u.pathname.startsWith("/videoplayback")) return [];
      const url = `${INVIDIOUS_INSTANCE}${u.pathname}${u.search}`;
      return [{ url, quality: str(s["qualityLabel"]) || str(s["resolution"]) || "auto", type: str(s["type"]).split(";")[0] || null }];
    } catch { return []; }
  }).sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
}

async function direct(path: string): Promise<unknown> {
  const res = await fetch(`${INVIDIOUS_INSTANCE}/api/v1/${path}`, {
    credentials: "omit", cache: "no-store", headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
    throw new Error("The video site is unavailable or requires a browser check. Try again later.");
  }
  return res.json();
}
const fail = (error: unknown): Fail => ({ success: false, error: error instanceof Error ? error.message : "The video site could not load." });

async function list(path: string): Promise<{ success: true; instance: string; results: InvidiousVideo[] } | Fail> {
  try {
    const data = await direct(path);
    if (!Array.isArray(data)) throw new Error("The video site returned invalid search results.");
    const videos = data.filter(record).filter((v) => str(v["videoId"]) && (v["type"] === undefined || v["type"] === "video")
      && v["ageRestricted"] !== true && v["isAgeRestricted"] !== true && v["requiresLogin"] !== true).map(shapeVideo);
    // Eligibility only: the instance's JSON, embeds and images remain direct.
    let blocked = new Set<string>();
    if (videos.length) {
      try {
        const res = await fetch("/api/public/invidious", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: videos.map((v) => v.videoId) }),
          signal: AbortSignal.timeout(4000),
        });
        const result: unknown = await res.json();
        if (res.ok && record(result) && Array.isArray(result["blocked"])) blocked = new Set(result["blocked"].filter((id): id is string => typeof id === "string"));
      } catch { /* An unavailable eligibility check must not blank results. */ }
    }
    return { success: true, instance: INVIDIOUS_INSTANCE, results: videos.filter((v) => !v.videoId || !blocked.has(v.videoId)) };
  } catch (error) { return fail(error); }
}
export function searchVideos(query: string, options?: { page?: number; region?: string }) {
  return list(`search?${new URLSearchParams({ q: query, type: "video", region: options?.region ?? "SG", page: String(options?.page ?? 1) })}`);
}
export function getTrending(options?: { region?: string }) {
  return list(`trending?region=${encodeURIComponent(options?.region ?? "SG")}&type=video`);
}
export async function getVideo(id: string): Promise<{ success: true; instance: string; video: InvidiousVideo } | Fail> {
  try {
    const data = await direct(`videos/${encodeURIComponent(id)}`);
    if (!record(data)) throw new Error("The video site returned invalid video details.");
    return { success: true, instance: INVIDIOUS_INSTANCE, video: shapeVideo({ ...data, videoId: id }) };
  } catch (error) { return fail(error); }
}
export async function getComments(id: string): Promise<{ success: true; comments: InvidiousComment[] } | Fail> {
  try {
    const data = await direct(`comments/${encodeURIComponent(id)}`);
    if (!record(data) || !Array.isArray(data["comments"])) throw new Error("Comments could not load.");
    return { success: true, comments: data["comments"].filter(record).map((c) => ({
      commentId: str(c["commentId"]) || null, author: str(c["author"]), authorAvatar: null,
      content: str(c["content"]), published: num(c["published"]), publishedText: str(c["publishedText"]) || null,
      likeCount: num(c["likeCount"]) ?? 0, replyCount: record(c["replies"]) ? num(c["replies"]["replyCount"]) ?? 0 : 0,
    })) };
  } catch (error) { return fail(error); }
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
