import { describe, expect, it } from "vitest";
import { applyBrowserHeaders, upstreamReferer } from "@/lib/proxy-compatibility";

describe("proxy compatibility", () => {
  it("keeps browser identity and language consistent across requests", () => {
    const input = new Headers({ "user-agent": "RadiumTestBrowser/1", "sec-ch-ua-platform": '"Android"', "accept-language": "fr-FR" });
    const first = new Headers(); const second = new Headers();
    applyBrowserHeaders(input, first); applyBrowserHeaders(input, second);
    expect(first.get("user-agent")).toBe("RadiumTestBrowser/1");
    expect(first.get("sec-ch-ua-platform")).toBe('"Android"');
    expect(first.get("accept-language")).toBe("fr-FR");
    expect([...first]).toEqual([...second]);
  });
  it("uses the upstream referring page without leaking the app address", () => {
    expect(upstreamReferer("https://radium.example/api/public/p?u=https%3A%2F%2Fexample.org%2Farticle")).toBe("https://example.org/article");
    expect(upstreamReferer("https://radium.example/")).toBeNull();
    expect(upstreamReferer("https://radium.example/api/public/p?u=javascript%3Aalert(1)")).toBeNull();
  });
});