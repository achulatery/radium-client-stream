import { getVideo } from "@/lib/invidious";
import { pipedStreams } from "@/lib/piped";

/** A failed or empty mirror must not hold up a usable response from another. */
export async function firstUsable<T>(requests: Promise<T>[], usable: (value: T) => boolean): Promise<T | null> {
  try {
    return await Promise.any(requests.map(async (request) => {
      const value = await request;
      if (!usable(value)) throw new Error("No usable response");
      return value;
    }));
  } catch {
    return null;
  }
}

type Stream = { url: string; quality: string; mimeType: string };
const pending = new Map<string, { expires: number; request: Promise<Stream[] | null> }>();

/** Only prefetch on user intent; short-lived signed URLs are never persisted. */
export function preloadVideo(videoId: string): Promise<Stream[] | null> {
  const cached = pending.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.request;
  const request = firstUsable([
    getVideo(videoId).then((r) => r.success
      ? (r.video.streams ?? []).map((s) => ({ url: s.url, quality: s.quality, mimeType: s.type ?? "" }))
      : []),
    pipedStreams(videoId).then((r) => r.success ? r.video.streams : []),
  ], (streams) => streams.length > 0);
  if (pending.size >= 8) {
    const oldest = pending.keys().next().value;
    if (oldest) pending.delete(oldest);
  }
  pending.set(videoId, { expires: Date.now() + 45_000, request });
  return request;
}