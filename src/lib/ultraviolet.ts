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
      // uv.sw.js is only the library; /uv/sw.js is the entry that wires it up.
      for (const old of await navigator.serviceWorker.getRegistrations()) {
        if (old.active?.scriptURL.endsWith("/uv/uv.sw.js")) await old.unregister();
      }
      const reg = await navigator.serviceWorker.register("/uv/sw.js", { scope: UV_PREFIX });
      // The Radium page sits outside the worker's scope, so serviceWorker.ready
      // never resolves here; wait for this registration to activate instead.
      const worker = reg.active ?? reg.installing ?? reg.waiting;
      if (!worker) return false;
      if (worker.state !== "activated") {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Ultraviolet worker timed out")), 10000);
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") { clearTimeout(timer); resolve(); }
            if (worker.state === "redundant") { clearTimeout(timer); reject(new Error("Ultraviolet worker failed")); }
          });
        });
      }
      return true;
    } catch {
      setupPromise = null;
      return false;
    }
  })();
  return setupPromise;
}
