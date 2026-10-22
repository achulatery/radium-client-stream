import { afterEach, describe, expect, it, vi } from "vitest";
import { UV_PREFIX, isHostingErrorPage, resetUltraviolet, setupUltraviolet, uvDecodeUrl, uvEncodeUrl, uvTargetOf, uvUrl } from "@/lib/ultraviolet";

afterEach(async () => { vi.unstubAllGlobals(); await resetUltraviolet(); });

describe("ultraviolet urls", () => {
  it("round-trips targets through the xor codec", () => {
    const target = "https://example.org/path/page?a=1&b=two";
    expect(uvDecodeUrl(uvEncodeUrl(target))).toBe(target);
  });

  it("builds proxy urls under the service prefix", () => {
    const proxied = uvUrl("https://example.org/article");
    expect(proxied.startsWith(UV_PREFIX)).toBe(true);
    expect(uvTargetOf(new URL(proxied, "https://radium.example").href)).toBe("https://example.org/article");
  });

  it("rejects non-proxy and non-http urls", () => {
    expect(uvTargetOf("https://radium.example/settings")).toBeNull();
    expect(uvTargetOf(`https://radium.example${UV_PREFIX}${uvEncodeUrl("javascript:alert(1)")}`)).toBeNull();
    expect(uvTargetOf("not a url")).toBeNull();
  });
  it("recognizes the missing-worker response rather than treating it as a loaded website", () => {
    expect(isHostingErrorPage("Ultraviolet is not connected. Return to Radium and retry the connection.")).toBe(true);
    expect(isHostingErrorPage("Deployment storage temporarily unavailable")).toBe(true);
    expect(isHostingErrorPage("Example Domain")).toBe(false);
  });
  it("reports unsupported browser APIs before starting a relay connection", async () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("SharedWorker", undefined);
    expect(await setupUltraviolet("wss://relay.test/")).toEqual({ ok: false, reason: "unsupported" });
  });
  it("reports blocked device storage without mistaking it for worker registration failure", async () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("SharedWorker", class {});
    vi.stubGlobal("BroadcastChannel", class {});
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("blocked"); } });
    expect(await setupUltraviolet("wss://relay.test/")).toEqual({ ok: false, reason: "storage" });
  });
});
