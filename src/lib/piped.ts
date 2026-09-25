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

async function call<T>(params: Record<string, string>): Promise<T | Fail> {
  try {
    const res = await fetch(`/api/public/piped?${new URLSearchParams(params)}`);
    const data = (await res.json().catch(() => null)) as T | Fail | null;
    if (!data) return { success: false, error: `Request failed (${res.status})` };
    return data;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

type List = { success: true; instance: string; results: PipedItem[] };

export const pipedSearch = (q: string) => call<List>({ action: "search", q });
export const pipedTrending = () => call<List>({ action: "trending", region: "SG" });
export const pipedStreams = (id: string) =>
  call<{ success: true; instance: string; video: PipedVideo }>({ action: "streams", id });
