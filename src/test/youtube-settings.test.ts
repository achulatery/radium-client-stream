import { describe, expect, it } from "vitest";
import { normalizeYouTubeSettings } from "@/lib/youtube-settings";

describe("owner YouTube settings", () => {
  it("defaults everyone to Invidious with the proxied mirror player", () => {
    expect(normalizeYouTubeSettings(null)).toEqual({ provider: "invidious", player: "mirror" });
  });
  it("keeps the owner's Piped + direct choice", () => {
    expect(normalizeYouTubeSettings({ provider: "piped", player: "direct" })).toEqual({ provider: "piped", player: "direct" });
  });
});
