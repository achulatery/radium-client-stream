import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PingCounter, SingaporeClock } from "@/components/PingCounter";
import { normalizeQuery, useRadium } from "@/lib/radium";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radium Client — Fast themeable web proxy" },
      {
        name: "description",
        content:
          "Radium Client is a customizable web proxy with Singapore-first routing, live latency, and smooth media streaming.",
      },
      { property: "og:title", content: "Radium Client — Fast themeable web proxy" },
      {
        property: "og:description",
        content: "Search or open any site through Radium Client's themeable proxy interface.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { settings, history } = useRadium();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const go = (raw: string) => {
    const url = normalizeQuery(raw);
    if (!url) return;
    navigate({ to: "/browse", search: { url } });
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}
    >
      <header className="flex items-center justify-end gap-2 p-4">
        {settings.singaporeClock && <SingaporeClock />}
        <PingCounter />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-16">
        <h1 className="text-center text-5xl font-semibold tracking-tight sm:text-6xl">
          Radium<span style={{ color: "var(--rd-accent)" }}> Client</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--rd-muted)" }}>
          branding by James Xie
        </p>

        <form
          className="mt-8 w-full max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            go(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the web or enter a URL"
            autoComplete="off"
            className="w-full rounded-full px-6 py-4 text-base outline-none"
            style={{
              background: "var(--rd-search)",
              color: "var(--rd-search-text)",
              border: "1px solid color-mix(in oklab, var(--rd-accent) 35%, transparent)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            }}
          />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="submit"
              className="rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-85"
              style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
            >
              Radium Search
            </button>
            <button
              type="button"
              onClick={() => go(query || "https://example.com")}
              className="rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-85"
              style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}
            >
              Open Directly
            </button>
          </div>
        </form>

        {history.length > 0 && (
          <div className="mt-12 w-full max-w-xl">
            <p className="mb-2 text-xs uppercase tracking-wide" style={{ color: "var(--rd-muted)" }}>
              Recently visited
            </p>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 8).map((h) => (
                <Link
                  key={h.url}
                  to="/browse"
                  search={{ url: h.url }}
                  className="max-w-full truncate rounded-full px-3 py-1.5 text-xs"
                  style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}
                >
                  {h.url.replace(/^https?:\/\//, "")}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer
        className="flex items-center justify-center gap-4 p-5 text-xs"
        style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}
      >
        <span>Radium Client</span>
        <Link to="/settings" style={{ color: "var(--rd-accent)" }}>
          Settings
        </Link>
      </footer>
    </div>
  );
}
