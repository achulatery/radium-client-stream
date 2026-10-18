import { canToggleSafeSearch, type AccountRole } from "./account-permissions";

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
    let url = new URL(raw);
    if (url.pathname === "/api/public/p") url = new URL(url.searchParams.get("u") ?? raw);
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
    if (url.pathname === "/api/public/p") url = new URL(url.searchParams.get("u") ?? raw);
    if (isDuckDuckGo(url) && url.searchParams.has("uddg")) url = new URL(url.searchParams.get("uddg") ?? raw);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch { return null; }
}