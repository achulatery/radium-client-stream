import { describe, expect, it } from "vitest";
import { parseSpotifyLink, spotifyUrl } from "@/lib/spotify";

describe("Spotify link playback", () => {
  it("accepts a Spotify track link with sharing parameters", () => {
    const item = parseSpotifyLink("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=test");
    expect(item?.id).toBe("4cOdK2wGLETKBW3PvgPWqT");
    expect(item && spotifyUrl(item)).toBe("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  });
  it("rejects non-Spotify destinations", () => {
    expect(parseSpotifyLink("https://example.com/track/4cOdK2wGLETKBW3PvgPWqT")).toBeNull();
    expect(parseSpotifyLink("javascript:alert(1)")).toBeNull();
  });
  it("accepts localized Spotify album links", () => {
    expect(parseSpotifyLink("https://open.spotify.com/intl-en/album/4cOdK2wGLETKBW3PvgPWqT")?.type).toBe("album");
  });
});