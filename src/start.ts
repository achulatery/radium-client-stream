import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Proxied pages sometimes navigate to a root-relative path (a site's own search
// form does this), which would land on the app's 404 page. Resolve such paths
// against the upstream page and bounce them back into the proxy.
const escapedNavMiddleware = createMiddleware().server(async ({ next, request }) => {
  const target = escapedNavigationTarget(request);
  if (target) {
    return new Response(null, {
      status: request.method === "POST" ? 307 : 302,
      headers: { location: target },
    });
  }
  return next();
});

function escapedNavigationTarget(request: Request): string | null {
  let incoming: URL;
  try {
    incoming = new URL(request.url);
  } catch {
    return null;
  }
  const path = incoming.pathname;
  if (path === "/" || path.startsWith("/api/") || path.startsWith("/_server")) return null;

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
    const target = new URL(path + incoming.search, proxied).toString();
    return `/api/public/p?u=${encodeURIComponent(target)}${stealth ? "&stealth=1" : ""}`;
  } catch {
    return null;
  }
}

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, escapedNavMiddleware],
}));

