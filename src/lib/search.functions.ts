import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { safeSearchEnabled } from "./browser-policy";

const requireUser = async () => (await import("./account-session.server")).requireUser();

export type WebResult = { title: string; url: string; snippet: string };

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(text: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m, name: string) => named[name] ?? m);
}

/** DuckDuckGo result links wrap the target in a redirect; unwrap it. */
function resultUrl(href: string): string | null {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const wrapped = url.searchParams.get("uddg");
    const target = new URL(wrapped ?? href, "https://duckduckgo.com");
    return /^https?:$/.test(target.protocol) ? target.href : null;
  } catch {
    return null;
  }
}

/** Organic Google results: anchors wrapping an <h3>, skipping Google's own links. */
export function parseGoogleResults(html: string): WebResult[] {
  const out: WebResult[] = [];
  const seen = new Set<string>();
  const blocks = html.matchAll(/<a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<h3[^>]*>([\s\S]*?)<\/h3>/g);
  for (const match of blocks) {
    const url = match[1] ?? "";
    try {
      const host = new URL(url).hostname;
      if (host === "google.com" || host.endsWith(".google.com") || host.endsWith(".gstatic.com")) continue;
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: decodeEntities(stripTags(match[3] ?? "")).trim(), url, snippet: "" });
    if (out.length >= 12) break;
  }
  return out;
}

async function searchGoogle(query: string, safe: boolean): Promise<WebResult[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=sg&num=12&pws=0&safe=${safe ? "active" : "off"}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": BROWSER_UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-SG,en;q=0.9",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok || res.url.includes("consent.google")) return [];
  return parseGoogleResults(await res.text());
}

async function searchDuckDuckGo(query: string, safe: boolean): Promise<WebResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=${safe ? "1" : "-2"}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": BROWSER_UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-SG,en;q=0.9",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const html = await res.text();

  const titles = [...html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
  const out: WebResult[] = [];
  for (let i = 0; i < titles.length && out.length < 12; i++) {
    const match = titles[i];
    if (!match) continue;
    const target = resultUrl(decodeEntities(match[1] ?? ""));
    if (!target) continue;
    out.push({
      title: decodeEntities(stripTags(match[2] ?? "")).trim(),
      url: target,
      snippet: decodeEntities(stripTags(snippets[i]?.[1] ?? "")).trim(),
    });
  }
  return out;
}

/**
 * Native web search: the search page itself is never proxied or framed, so
 * search engines see an ordinary server request instead of a proxied browser,
 * which avoids the bot checks proxied search pages trigger. Only the site the
 * user actually opens goes through the proxy. DuckDuckGo is primary; Google
 * is the fallback when DuckDuckGo declines the request.
 */
export const searchWeb = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ query: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<WebResult[]> => {
    const user = await requireUser();
    const settings = (user.settings ?? null) as { duckduckgoSafeSearch?: boolean } | null;
    const safe = safeSearchEnabled(user.role, settings?.duckduckgoSafeSearch);
    const ddg = await searchDuckDuckGo(data.query, safe).catch(() => []);
    if (ddg.length > 0) return ddg;
    const google = await searchGoogle(data.query, safe).catch(() => []);
    if (google.length > 0) return google;
    throw new Error("Search is unavailable right now");
  });
