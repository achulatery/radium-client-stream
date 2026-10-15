import { describe, expect, it } from "vitest";
import { firstUsable } from "@/lib/video-loading";

describe("parallel video loading", () => {
  it("returns the working mirror without waiting for a stalled one", async () => {
    const stalled = new Promise<string>(() => {});
    expect(await firstUsable([stalled, Promise.resolve("ready")], Boolean)).toBe("ready");
  });
  it("ignores empty and failed responses", async () => {
    expect(await firstUsable([Promise.resolve(""), Promise.reject(new Error("offline")), Promise.resolve("stream")], Boolean)).toBe("stream");
  });
  it("returns null when no mirror has usable media", async () => {
    expect(await firstUsable([Promise.resolve("")], Boolean)).toBeNull();
  });
});