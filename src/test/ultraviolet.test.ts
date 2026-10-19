import { describe, expect, it } from "vitest";
import { UV_PREFIX, uvDecodeUrl, uvEncodeUrl, uvTargetOf, uvUrl } from "@/lib/ultraviolet";

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
});
