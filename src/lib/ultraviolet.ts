/**
 * Ultraviolet (Titanium Network) client-side proxy setup.
 * Pure URL helpers live at module scope; all browser work happens inside
 * setupUltraviolet, which must only be called from effects or handlers.
 */

export const UV_PREFIX = "/uv/service/";

/** Ultraviolet's xor codec — must match public/uv/uv.config.js. */
export function uvEncodeUrl(url: string): string {
  if (!url) return url;
  return encodeURIComponent(
    url
      .split("")
      .map((char, i) => (i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
      .join(""),
  );
}

export function uvDecodeUrl(encoded: string): string {
  if (!encoded) return encoded;
  const [input, ...search] = encoded.split("?");
  const decoded = decodeURIComponent(input ?? "")
    .split("")
    .map((char, i) => (i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
    .join("");
  return decoded + (search.length ? `?${search.join("?")}` : "");
}

export function uvUrl(target: string) {
  return `${UV_PREFIX}${uvEncodeUrl(target)}`;
}

/** Decode a same-origin /uv/service/ URL back to its target, or null. */
export function uvTargetOf(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!url.pathname.startsWith(UV_PREFIX)) return null;
    const target = uvDecodeUrl(url.pathname.slice(UV_PREFIX.length));
    return /^https?:$/.test(new URL(target).protocol) ? target : null;
  } catch {
    return null;
  }
}

let setupPromise: Promise<boolean> | null = null;

/**
 * Registers the Ultraviolet service worker and connects it to the Wisp
 * server. Resolves false when service workers are unavailable, in which case
 * the caller falls back to the edge proxy.
 */
export function setupUltraviolet(wispServer: string): Promise<boolean> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
      const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
      const connection = new BareMuxConnection("/baremux/worker.js");
      await connection.setTransport("/libcurl/index.mjs", [{ wisp: wispServer }]);
      await navigator.serviceWorker.register("/uv/uv.sw.js", { scope: UV_PREFIX });
      return true;
    } catch {
      setupPromise = null;
      return false;
    }
  })();
  return setupPromise;
}
