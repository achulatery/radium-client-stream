import { createFileRoute, Link, redirect } from "@tanstack/react-router";

/**
 * Catch-all. Proxied pages sometimes navigate to a root-relative path (YouTube's
 * own search box does this), which lands here instead of on the proxy. When the
 * referer is a proxied page we resolve the path against it and bounce back into
 * the proxy, so in-site navigation keeps working. Anything else renders the 404
 * page.
 */
export const Route = createFileRoute("/$")({
  loader: async () => {
    if (typeof window !== "undefined") return null;
    const { escapedNavigationTarget } = await import("@/lib/escaped-nav.server");
    const target = escapedNavigationTarget();
    if (target) throw redirect({ href: target });
    return null;
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
