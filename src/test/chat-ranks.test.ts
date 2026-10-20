import { describe, expect, it } from "vitest";
import { attachmentLimit, formatBytes, UNLIMITED_BYTES } from "@/lib/chat-ranks";

describe("per-message media limits", () => {
  it("VIP 15 MB", () => expect(attachmentLimit(null, "vip")).toBe(15_000_000));
  it("MVP 300 MB", () => expect(attachmentLimit(null, "mvp")).toBe(300_000_000));
  it("MYTHIC 3 GB", () => expect(attachmentLimit(null, "mythic")).toBe(3_000_000_000));
  it("LEGEND 10 GB", () => expect(attachmentLimit(null, "legend")).toBe(10_000_000_000));
  it("members keep the 10 MB limit", () => expect(attachmentLimit(null, null)).toBe(10_000_000));
  it("RADIUM, contributor, admin and owner unlimited", () => {
    expect(attachmentLimit(null, "radium")).toBe(UNLIMITED_BYTES);
    expect(attachmentLimit("contributor", null)).toBe(UNLIMITED_BYTES);
    expect(attachmentLimit("admin", null)).toBe(UNLIMITED_BYTES);
    expect(attachmentLimit("owner", null)).toBe(UNLIMITED_BYTES);
    expect(formatBytes(UNLIMITED_BYTES)).toBe("Unlimited");
  });
});
