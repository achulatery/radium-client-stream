import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PingCounter, SingaporeClock } from "@/components/PingCounter";
import { normalizeQuery, proxyUrl, useRadium } from "@/lib/radium";

type Search = { url: string };

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    url: typeof search.url === "string" ? search.url : "https://example.com",
  }),
  head: () => ({
    meta: [
      { title: "Browsing — Radium Client" },
      { name: "description", content: "Browse any site through the Radium Client proxy viewer." },
      { property: "og:title", content: "Browsing — Radium Client" },
      { property: "og:description", content: "Proxied browsing with live latency and themes." },
    ],
  }),
  component: Browse,
});

function Browse() {
  const { url } = Route.useSearch();
  const navigate = useNavigate();
  const { settings, pushHistory } = useRadium();
  const [input, setInput] = useState(url);
  const [current, setCurrent] = useState(url);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setInput(url);
    setCurrent(url);
    pushHistory(url);
  }, [url, pushHistory]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { __radium?: string; url?: string };
      if (data?.__radium === "navigate" && data.url) {
        setCurrent(data.url);
        setInput(data.url);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normalizeQuery(input);
    if (next) navigate({ to: "/browse", search: { url: next } });
  };

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-opacity hover:opacity-80";

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}
    >
      <div
        className="flex flex-wrap items-center gap-2 p-2"
        style={{ background: "var(--rd-surface)" }}
      >
        <button
          className={iconBtn}
          style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
          onClick={() => frame.current?.contentWindow?.history.back()}
          aria-label="Back"
        >
          ←
        </button>
        <button
          className={iconBtn}
          style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
          onClick={() => frame.current?.contentWindow?.history.forward()}
          aria-label="Forward"
        >
          →
        </button>
        <button
          className={iconBtn}
          style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
          onClick={() => {
            if (frame.current) frame.current.src = proxyUrl(current, settings.stealth);
          }}
          aria-label="Refresh"
        >
          ⟳
        </button>
        <form onSubmit={submit} className="min-w-0 flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-full px-4 py-2 text-sm outline-none"
            style={{ background: "var(--rd-search)", color: "var(--rd-search-text)" }}
            aria-label="Address bar"
          />
        </form>
        {settings.singaporeClock && <SingaporeClock />}
        <PingCounter />
        <Link
          to="/"
          className="rounded-full px-3 py-1.5 text-xs"
          style={{ background: "var(--rd-button)", color: "var(--rd-button-text)" }}
        >
          Home
        </Link>
      </div>

      <iframe
        ref={frame}
        title="Proxied content"
        src={proxyUrl(url, settings.stealth)}
        className="flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-presentation"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      />
    </div>
  );
}
