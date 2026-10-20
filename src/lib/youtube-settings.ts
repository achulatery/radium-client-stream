export type YouTubeProvider = "invidious" | "piped";
export type YouTubePlayer = "mirror" | "direct";
export type YouTubeSettings = { provider: YouTubeProvider; player: YouTubePlayer };

export const DEFAULT_YOUTUBE_SETTINGS: YouTubeSettings = { provider: "invidious", player: "mirror" };

/** Unknown or partial stored values fall back to the defaults. */
export function normalizeYouTubeSettings(raw: unknown): YouTubeSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    provider: v["provider"] === "piped" ? "piped" : "invidious",
    player: v["player"] === "direct" ? "direct" : "mirror",
  };
}
