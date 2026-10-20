import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const helpers = () => import("./account-session.server");

const ENTITY: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&nbsp;": " " };
const decodeEntities = (html: string) => html.replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39);/g, (m) => ENTITY[m] ?? m);
const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, "")).trim();

/** DuckDuckGo result links wrap the destination in a redirect parameter. */
function unwrap(url: string) {
  try {
    const parsed = new URL(url.startsWith("//") ? `https:${url}` : url);
    const nested = parsed.searchParams.get("uddg");
    return nested ? new URL(nested).href : parsed.href;
  } catch { return null; }
}

export type WebResult = { title: string; url: string; snippet: string };

/** Native DuckDuckGo search for signed-in users — never proxied, never framed. */
export const searchWeb = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(1).max(200), safe: z.boolean() }).parse(d))
  .handler(async ({ data }): Promise<WebResult[]> => {
    const { requireUser } = await helpers();
    await requireUser();
    const params = new URLSearchParams({ q: data.q, kp: data.safe ? "1" : "-2" });
    const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", Accept: "text/html" },
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("text/html")) throw new Error("DuckDuckGo declined the search; try again");
    const html = await response.text();
    const links = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
    const results: WebResult[] = [];
    for (const [i, link] of links.entries()) {
      const url = unwrap(decodeEntities(link[1] ?? ""));
      if (!url || !/^https?:$/.test(new URL(url).protocol)) continue;
      results.push({ title: stripTags(link[2] ?? "") || url, url, snippet: snippets[i] ? stripTags(snippets[i]?.[1] ?? "") : "" });
      if (results.length >= 15) break;
    }
    return results;
  });
