import { createFileRoute } from "@tanstack/react-router";
import { uvDecodeUrl } from "@/lib/ultraviolet";

/**
 * Reached only when the Ultraviolet service worker is not controlling the page
 * yet (first visit, worker still installing). Hand the site to the edge proxy
 * instead of letting the request fall through to a hosting error.
 */
function fallback(request: Request) {
  const url = new URL(request.url);
  const encoded = url.pathname.slice("/uv/service/".length) + url.search;
  let target = "";
  try { target = uvDecodeUrl(encoded); } catch { /* invalid encoding */ }
  try {
    const parsed = new URL(target);
    if (/^https?:$/.test(parsed.protocol)) {
      return Response.redirect(new URL(`/api/public/p?u=${encodeURIComponent(parsed.href)}`, url).href, 302);
    }
  } catch { /* fall through */ }
  return Response.redirect(new URL("/", url).href, 302);
}

export const Route = createFileRoute("/uv/service/$")({
  server: { handlers: { GET: ({ request }) => fallback(request), HEAD: ({ request }) => fallback(request) } },
});
