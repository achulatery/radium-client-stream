import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Catch-all. Proxied pages sometimes navigate to a root-relative path (YouTube's
 * own search box does this), which lands here instead of on the proxy. When the
 * referer is a proxied page we resolve the path against it and bounce back into
 * the proxy, so in-site navigation keeps working.
 */
export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: ({ request }) => redirectEscapedNavigation(request),
      POST: ({ request }) => redirectEscapedNavigation(request),
    },
  },
  head: () => ({
    meta: [
      { title: "Page not found — Radium Client" },
      { name: "description", content: "This Radium Client page does not exist." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Page not found — Radium Client" },
      { property: "og:description", content: "This Radium Client page does not exist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotFound,
});

function redirectEscapedNavigation(request: Request) {
  const referer = request.headers.get("referer");
  const dest = request.headers.get("sec-fetch-dest");
  const isSubresource = !!dest && dest !== "document" && dest !== "iframe" && dest !== "frame";
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
  if (proxied) {
    try {
      const incoming = new URL(request.url);
      const target = new URL(incoming.pathname + incoming.search, proxied).toString();
      return new Response(null, {
        status: request.method === "POST" ? 307 : 302,
        headers: {
          location: `/api/public/p?u=${encodeURIComponent(target)}${stealth ? "&stealth=1" : ""}`,
        },
      });
    } catch {
      /* fall through to the 404 handling below */
    }
  }
  // Assets, scripts and API calls must not receive the HTML 404 page: strict MIME
  // checking then reports a broken stylesheet/script instead of a missing file.
  if (isSubresource) return new Response("Not found", { status: 404 });
  return undefined as unknown as Response;
}

function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}
    >
      <p className="font-mono text-xs tracking-[0.3em]" style={{ color: "var(--rd-muted)" }}>
        RADIUM CLIENT · 404
      </p>
      <h1 className="text-3xl font-semibold">That address isn't here.</h1>
      <Link
        to="/"
        className="rounded-md px-5 py-2.5 text-sm font-medium"
        style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
      >
        Back to Radium
      </Link>
    </div>
  );
}
