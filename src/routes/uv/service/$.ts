import { createFileRoute } from "@tanstack/react-router";
import { uvDecodeUrl } from "@/lib/ultraviolet";

/**
 * A missing worker must never silently switch to the retired edge proxy.
 */
function fallback(request: Request) {
  const url = new URL(request.url);
  const encoded = url.pathname.slice("/uv/service/".length) + url.search;
  let target = "";
  try { target = uvDecodeUrl(encoded); } catch { /* invalid encoding */ }
  try {
    const parsed = new URL(target);
    if (/^https?:$/.test(parsed.protocol)) {
      return new Response("Ultraviolet is not connected. Return to Radium and retry the connection.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
  } catch { /* fall through */ }
  return Response.redirect(new URL("/", url).href, 302);
}

export const Route = createFileRoute("/uv/service/$")({
  server: { handlers: { GET: ({ request }) => fallback(request), HEAD: ({ request }) => fallback(request) } },
});
