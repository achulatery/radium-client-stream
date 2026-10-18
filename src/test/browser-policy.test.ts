import { describe, expect, it } from "vitest";
import { applySearchPolicy, safeSearchEnabled, cleanBrowserAddress, browserDestination, searchQueryOf } from "@/lib/browser-policy";

describe("browser policy", () => {
  it("forces strict Safe Search for members even with a disabled preference", () => { expect(safeSearchEnabled(null, false)).toBe(true); expect(applySearchPolicy(new URL("https://duckduckgo.com/?q=cats&kp=-2"), safeSearchEnabled(null, false)).searchParams.get("kp")).toBe("1"); });
  it("forces strict Safe Search for mods", () => { expect(safeSearchEnabled("mod", false)).toBe(true); });
  it("lets only admins and owners turn their own Safe Search off", () => { for (const role of ["admin", "owner"] as const) { expect(safeSearchEnabled(role, false)).toBe(false); expect(safeSearchEnabled(role, true)).toBe(true); } });
  it("applies strict policy to DuckDuckGo image search but not lookalike hosts", () => { expect(applySearchPolicy(new URL("https://duckduckgo.com/i.js?kp=-2"), true).searchParams.get("kp")).toBe("1"); expect(applySearchPolicy(new URL("https://duckduckgo.com.evil.test/?kp=-2"), true).searchParams.get("kp")).toBe("-2"); });
  it("shows upstream addresses and unwraps DuckDuckGo result redirects", () => { expect(cleanBrowserAddress("https://app.test/api/public/p?u=https%3A%2F%2Fexample.com%2Farticle%3Ftracking%3D1")).toBe("example.com/article"); expect(browserDestination("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F")).toBe("https://example.com/"); });
  it("detects search pages so they load natively, never proxied", () => { expect(searchQueryOf("https://duckduckgo.com/?q=cats")).toBe("cats"); expect(searchQueryOf("https://example.com/?q=cats")).toBeNull(); expect(searchQueryOf("https://duckduckgo.com/")).toBeNull(); expect(searchQueryOf("not a url")).toBeNull(); });
});