import { afterEach, expect, it, vi } from "vitest";
import { invidiousEmbedUrl, invidiousThumbnailUrl, searchVideos } from "@/lib/invidious";

afterEach(() => vi.unstubAllGlobals());

it("uses invidious.tiekoetter.com directly for embeds and thumbnails", () => {
  expect(invidiousEmbedUrl("abcdefghijk")).toBe("https://invidious.tiekoetter.com/embed/abcdefghijk?autoplay=1&local=true");
  expect(invidiousThumbnailUrl("abcdefghijk")).toBe("https://invidious.tiekoetter.com/vi/abcdefghijk/hqdefault.jpg");
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
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://invidious.tiekoetter.com/api/v1/search?q=test&type=video&region=SG&page=1");
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
import { getVideo, instanceStreams } from "@/lib/invidious";
it("requests local=true so streams are served by the instance", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({
    videoId: "abcdefghijk", title: "Local", formatStreams: [
      { url: "https://invidious.tiekoetter.com/videoplayback?id=1", qualityLabel: "360p", type: "video/mp4; codecs=x" },
    ],
  }));
  vi.stubGlobal("fetch", fetcher);
  const result = await getVideo("abcdefghijk");
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://invidious.tiekoetter.com/api/v1/videos/abcdefghijk?local=true");
  expect(result.success && result.video.streams?.[0]?.url).toBe("https://invidious.tiekoetter.com/videoplayback?id=1");
});
it("keeps only instance-served streams and drops googlevideo.com", () => {
  const s = instanceStreams([
    { url: "https://invidious.tiekoetter.com/videoplayback?id=1", qualityLabel: "360p", type: "video/mp4; codecs=x" },
    { url: "https://rr1.googlevideo.com/videoplayback?id=1", qualityLabel: "720p" },
  ]);
  expect(s).toEqual([{ url: "https://invidious.tiekoetter.com/videoplayback?id=1", quality: "360p", type: "video/mp4" }]);
});
