import { afterEach, describe, expect, it, vi } from "vitest";
import { playableWithoutLogin } from "@/routes/api/public/piped";

const stub = (impl: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

describe("age-restricted video filtering", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drops videos YouTube reports as sign-in/age restricted (401)", async () => {
    stub(() => Promise.resolve(new Response("{}", { status: 401 })));
    expect(await playableWithoutLogin("restricted-id")).toBe(false);
  });

  it("keeps normally playable videos (200)", async () => {
    stub(() => Promise.resolve(new Response("{}", { status: 200 })));
    expect(await playableWithoutLogin("normal-id")).toBe(true);
  });

  it("fails open when the check itself cannot run", async () => {
    stub(() => Promise.reject(new Error("offline")));
    expect(await playableWithoutLogin("unknown-id")).toBe(true);
  });
});
