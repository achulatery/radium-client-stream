/** Preserve the browser's own identity rather than rotating identities mid-session. */
export function applyBrowserHeaders(incoming: Headers, outgoing: Headers) {
  const ua = incoming.get("user-agent");
  if (ua) outgoing.set("user-agent", ua);
  for (const name of ["sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform"]) {
    const value = incoming.get(name);
    if (value) outgoing.set(name, value);
  }
  if (!outgoing.has("accept")) outgoing.set("accept", "*/*");
  if (!outgoing.has("accept-language")) outgoing.set("accept-language", incoming.get("accept-language") ?? "en-SG,en;q=0.9");
}

/** Only upstream proxy URLs are translated; never send the app's own URL upstream. */
export function upstreamReferer(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.pathname !== "/api/public/p") return null;
    const target = new URL(url.searchParams.get("u") ?? "");
    return /^https?:$/.test(target.protocol) ? target.href : null;
  } catch { return null; }
}