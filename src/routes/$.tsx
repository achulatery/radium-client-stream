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
      GET: ({ request }) => {
        const referer = request.headers.get("referer");
        if (referer) {
          try {
            const refUrl = new URL(referer);
            const proxied = refUrl.searchParams.get("u");
            if (refUrl.pathname === "/api/public/p" && proxied) {
              const incoming = new URL(request.url);
              const target = new URL(incoming.pathname + incoming.search, proxied).toString();
              const stealth = refUrl.searchParams.get("stealth") === "1";
              return new Response(null, {
                status: 302,
                headers: {
                  location: `/api/public/p?u=${encodeURIComponent(target)}${stealth ? "&stealth=1" : ""}`,
                },
              });
            }
          } catch {
            /* fall through to the 404 page */
          }
        }
        return undefined as unknown as Response;
      },
    },
  },
  head: () => ({
    meta: [
      { title: "Page not found — Radium Client" },
      { name: "description", content: "This Radium Client page does not exist." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Page not found — Radium Client" },
      { property: "og:description", content: "This Radium Client page does not exist." },
    ],
  }),
  component: NotFound,
});

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
