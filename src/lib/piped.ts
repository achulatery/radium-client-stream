export type PipedItem = {
  videoId: string;
  title: string;
  author: string;
  views: number | null;
  uploaded: string | null;
  duration: number | null;
  thumbnail: string | null;
};

export type PipedStream = { url: string; quality: string; mimeType: string };

export type PipedVideo = {
  videoId: string;
  title: string;
  author: string;
  views: number | null;
  duration: number | null;
  description: string;
  thumbnail: string;
  hls: string | null;
  streams: PipedStream[];
};

type Fail = { success: false; error: string };

async function once<T>(params: Record<string, string>): Promise<T | Fail | null> {
  const qs = new URLSearchParams({ ...params, _t: String(Date.now()) });
  const res = await fetch(`/api/public/piped?${qs}`, {
    cache: "no-store",
    credentials: "omit",
    headers: { accept: "application/json" },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    return null; // HTML or empty body (e.g. Home Screen cache) — caller retries
  }
  if (!data || typeof data !== "object") return null;
  const d = data as { success?: unknown; error?: unknown };
  if (d.success === true) return data as T;
  return { success: false, error: typeof d.error === "string" ? d.error : `Piped request failed (${res.status}).` };
}

async function call<T>(params: Record<string, string>): Promise<T | Fail> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await once<T>(params);
      if (r) return r;
    } catch {
      /* retry */
    }
  }
  return { success: false, error: "Piped is not responding right now. Please try again in a moment." };
}

type List = { success: true; instance: string; nextpage?: string | null; results: PipedItem[] };

export const thumbUrl = (id: string) => `/api/public/thumb?id=${encodeURIComponent(id)}`;
export const pipedSearch = (q: string) => call<List>({ action: "search", q });
export const pipedTrending = () => call<List>({ action: "trending", region: "SG" });
export const pipedStreams = (id: string) =>
  call<{ success: true; instance: string; video: PipedVideo }>({ action: "streams", id });
export const pipedMore = (q: string, nextpage: string) => call<List>({ action: "more", q, nextpage });
