import { getRequest } from "@tanstack/react-start/server";

/**
 * When a proxied page navigates to a root-relative path, resolve it against the
 * upstream page (referer or radium_base cookie) and send it back to the proxy.
 */
export function escapedNavigationTarget(): string | null {
  let request: Request;
  try {
    request = getRequest();
  } catch {
    return null;
  }
  const referer = request.headers.get("referer");
  let proxied: string | null = null;
  let stealth = false;
  if (referer) {
    try {
      const refUrl = new URL(referer);
      if (refUrl.pathname === "/api/public/p") {
        proxied = refUrl.searchParams.get("u");
        stealth = refUrl.searchParams.get("stealth") === "1";
      }
    } catch {
      /* fall back to the navigation cookie */
    }
  }
  if (!proxied) {
    const match = request.headers.get("cookie")?.match(/(?:^|;\s*)radium_base=([^;]+)/);
    if (match?.[1]) {
      try {
        proxied = decodeURIComponent(match[1]);
      } catch {
        proxied = null;
      }
    }
  }
  if (!proxied) return null;
  try {
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, proxied).toString();
    return `/api/public/p?u=${encodeURIComponent(target)}${stealth ? "&stealth=1" : ""}`;
  } catch {
    return null;
  }
}
