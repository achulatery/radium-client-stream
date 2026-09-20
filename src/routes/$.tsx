import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Catch-all 404 page. Root-relative navigations that escape a proxied page are
 * bounced back into the proxy by the request middleware in src/start.ts before
 * they ever reach this route.
 */
export const Route = createFileRoute("/$")({
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
