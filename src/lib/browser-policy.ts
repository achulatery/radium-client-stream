import { canToggleSafeSearch, type AccountRole } from "./account-permissions";
import { UV_PREFIX, uvDecodeUrl } from "./ultraviolet";

export function safeSearchEnabled(role: AccountRole, preference: unknown = true) {
  return !canToggleSafeSearch(role) || preference !== false;
}

export function isDuckDuckGo(url: URL) {
  return url.hostname === "duckduckgo.com" || url.hostname.endsWith(".duckduckgo.com");
}

export function applySearchPolicy(url: URL, safe: boolean) {
  const next = new URL(url);
  if (isDuckDuckGo(next)) next.searchParams.set("kp", safe ? "1" : "-2");
  return next;
}

export function cleanBrowserAddress(raw: string) {
  try {
    const url = new URL(browserDestination(raw) ?? raw);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.host}${path}${url.searchParams.has("q") ? `?q=${url.searchParams.get("q") ?? ""}` : ""}`;
  } catch { return raw; }
}

/** Returns the search query when the URL is a search page, null for real sites. */
export function searchQueryOf(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (isDuckDuckGo(url) && url.searchParams.has("q")) return url.searchParams.get("q");
    return null;
  } catch {
    return null;
  }
}

export function browserDestination(raw: string) {
  try {
    let url = new URL(raw);
    // Unwrap Radium's own proxy addresses so they are never proxied again
    // (re-wrapping them nests the URL endlessly until the request fails).
    for (let i = 0; i < 5; i++) {
      if (url.pathname === "/api/public/p" && url.searchParams.has("u")) url = new URL(url.searchParams.get("u") ?? "");
      else if (url.pathname.startsWith(UV_PREFIX)) url = new URL(uvDecodeUrl(url.pathname.slice(UV_PREFIX.length) + url.search));
      else break;
    }
    if (url.pathname.startsWith(UV_PREFIX) || url.pathname === "/api/public/p") return null;
    if (isDuckDuckGo(url) && url.searchParams.has("uddg")) url = new URL(url.searchParams.get("uddg") ?? raw);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch { return null; }
}