import { describe, expect, it } from "vitest";
import { canPreviewMedia, mediaMime, prepareChatMedia } from "@/lib/chat-media";

describe("chat image compatibility", () => {
  it("infers image types when the device supplies no MIME type", () => {
    expect(mediaMime("PHOTO.JPG", "")).toBe("image/jpeg");
    expect(mediaMime("photo.avif", "application/octet-stream")).toBe("image/avif");
  });
  it("serves AVIF inline while rejecting executable SVG previews", () => {
    expect(canPreviewMedia("image/avif")).toBe(true);
    expect(canPreviewMedia("image/svg+xml")).toBe(false);
  });
  it("normalises a JPEG's missing type before upload", async () => {
    const prepared = await prepareChatMedia(new File(["photo"], "photo.jpg"));
    expect(prepared.type).toBe("image/jpeg");
    expect(prepared.size).toBe(5);
  });
  it("rejects image formats that cannot be displayed", async () => {
    await expect(prepareChatMedia(new File(["svg"], "photo.svg", { type: "image/svg+xml" }))).rejects.toThrow("Choose a JPEG");
  });
});