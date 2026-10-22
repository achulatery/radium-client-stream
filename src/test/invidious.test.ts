import { afterEach, expect, it, vi } from "vitest";
import { invidiousEmbedUrl, invidiousThumbnailUrl, searchVideos } from "@/lib/invidious";

afterEach(() => vi.unstubAllGlobals());

it("uses tube.mint.lgbt directly for embeds and thumbnails", () => {
  expect(invidiousEmbedUrl("abcdefghijk")).toBe("https://tube.mint.lgbt/embed/abcdefghijk?autoplay=1&local=true");
  expect(invidiousThumbnailUrl("abcdefghijk")).toBe("https://tube.mint.lgbt/vi/abcdefghijk/hqdefault.jpg");
});

it("searches the supplied instance directly while excluding restricted videos", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json([
    { type: "video", videoId: "abcdefghijk", title: "Allowed" },
    { type: "video", videoId: "restricted1", title: "Restricted" },
    { type: "video", videoId: "restricted2", ageRestricted: true },
    { type: "channel", title: "Channel" },
  ])).mockResolvedValueOnce(Response.json({ blocked: ["restricted1"] }));
  vi.stubGlobal("fetch", fetcher);
  const result = await searchVideos("test");
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://tube.mint.lgbt/api/v1/search?q=test&type=video&region=SG&page=1");
  expect(result.success && result.results.map((v) => v.videoId)).toEqual(["abcdefghijk"]);
});

it("keeps usable results if the eligibility service is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json([
    { type: "video", videoId: "abcdefghijk", title: "Allowed" },
    { type: "video", videoId: "restricted1", requiresLogin: true },
  ])).mockRejectedValueOnce(new Error("offline")));
  const result = await searchVideos("test");
  expect(result.success && result.results.map((v) => v.videoId)).toEqual(["abcdefghijk"]);
});