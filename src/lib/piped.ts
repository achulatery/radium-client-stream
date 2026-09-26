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
    const res = await fetch(`/api/public/piped?${new URLSearchParams(params)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!type.toLowerCase().includes("application/json")) {
      return { success: false, error: "Piped returned a page instead of video data. Open Radium in your browser and try again." };
    }
    const data: unknown = await res.json().catch(() => null);
    if (!data || typeof data !== "object" || !("success" in data) || typeof data.success !== "boolean") {
      return { success: false, error: "Piped returned an invalid response. Please try again." };
    }
    if (!res.ok) {
      return { success: false, error: "error" in data && typeof data.error === "string" ? data.error : `Piped request failed (${res.status}).` };
    }
    return data as T | Fail;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Piped is unavailable. Check your connection and try again." };
  }
}

type List = { success: true; instance: string; results: PipedItem[] };

export const pipedSearch = (q: string) => call<List>({ action: "search", q });
export const pipedTrending = () => call<List>({ action: "trending", region: "SG" });
export const pipedStreams = (id: string) =>
  call<{ success: true; instance: string; video: PipedVideo }>({ action: "streams", id });
