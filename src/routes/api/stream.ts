import { createFileRoute } from "@tanstack/react-router";

/** Same-origin media relay: pipes upstream video bytes and preserves Range for seeking. */
const ALLOWED = /(^|\.)(googlevideo\.com|ytimg\.com|youtube\.com)$|piped|invidious|yewtu\.be|puffyan/i;
const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

async function relay(request: Request, method: "GET" | "HEAD") {
  const raw = new URL(request.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }
  const headers: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    accept: "*/*",
  };
  const range = request.headers.get("range");
  if (range) headers["range"] = range;
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { method, headers, redirect: "follow" });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  const out = new Headers({ "access-control-allow-origin": "*", "cache-control": "no-store" });
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");
  return new Response(method === "HEAD" ? null : upstream.body, { status: upstream.status, headers: out });
}

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: ({ request }) => relay(request, "GET"),
      HEAD: ({ request }) => relay(request, "HEAD"),
    },
  },
});
