import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { safeSearchEnabled } from "./browser-policy";

const requireUser = async () => (await import("./account-session.server")).requireUser();

export type WebResult = { title: string; url: string; snippet: string };

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

/**
 * Native web search: the search page itself is never proxied or framed, so
 * search engines see an ordinary server request instead of a proxied browser,
 * which avoids the bot checks proxied search pages trigger. Only the site the
 * user actually opens goes through the proxy.
 */
export const searchWeb = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ query: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<WebResult[]> => {
    const user = await requireUser();
    const settings = (user.settings ?? null) as { duckduckgoSafeSearch?: boolean } | null;
    const safe = safeSearchEnabled(user.role, settings?.duckduckgoSafeSearch);
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(data.query)}&kp=${safe ? "1" : "-2"}`;
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-SG,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error("Search is unavailable right now");
    const html = await res.text();

    const titles = [...html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
    const out: WebResult[] = [];
    for (let i = 0; i < titles.length && out.length < 12; i++) {
      const target = resultUrl(decodeEntities(titles[i][1]));
      if (!target) continue;
      out.push({
        title: decodeEntities(stripTags(titles[i][2])).trim(),
        url: target,
        snippet: decodeEntities(stripTags(snippets[i]?.[1] ?? "")).trim(),
      });
    }
    return out;
  });
