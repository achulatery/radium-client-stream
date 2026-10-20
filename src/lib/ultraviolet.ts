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

export type UvFailure = "private-mode" | "relay" | "transport" | "register" | "activate" | "probe";
export type UvSetup = { ok: boolean; reason?: UvFailure };

let setupPromise: Promise<UvSetup> | null = null;

/**
 * Registers the Ultraviolet service worker and connects it to the Wisp
 * server. Resolves ok:false with the failing step when unavailable.
 */
function wispReachable(server: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    try { socket = new WebSocket(server); } catch { resolve(false); return; }
    const done = (ok: boolean) => { clearTimeout(timer); try { socket.close(); } catch { /* already closed */ } resolve(ok); };
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.onopen = () => done(true);
    socket.onerror = () => done(false);
  });
}

function probeUltraviolet(timeoutMs = 12000): Promise<boolean> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px";
    frame.setAttribute("aria-hidden", "true");
    const finish = (ok: boolean) => { clearTimeout(timer); frame.remove(); resolve(ok); };
    const timer = setTimeout(() => finish(false), timeoutMs);
    frame.onload = () => {
      try { finish(/example domain/i.test(frame.contentDocument?.title ?? "")); } catch { finish(false); }
    };
    frame.src = uvUrl("https://example.com/");
    document.body.appendChild(frame);
  });
}

export function setupUltraviolet(wispServer: string): Promise<boolean> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
      // Ultraviolet depends on an outside Wisp relay; when it is down every
      // site fails, so only use Ultraviolet when the relay actually answers.
      if (!(await wispReachable(wispServer))) return false;
      const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
      const connection = new BareMuxConnection("/baremux/worker.js");
      await connection.setTransport("/libcurl/index.mjs", [{ wisp: wispServer }]);
      // uv.sw.js is only the library; /uv/sw.js is the entry that wires it up.
      // Devices that visited older versions can still hold outdated workers;
      // drop anything that isn't the current entry and refresh the rest.
      for (const old of await navigator.serviceWorker.getRegistrations()) {
        const script = (old.active ?? old.waiting ?? old.installing)?.scriptURL ?? "";
        if (!script.endsWith("/uv/sw.js")) await old.unregister();
      }
      const reg = await navigator.serviceWorker.register("/uv/sw.js", { scope: UV_PREFIX, updateViaCache: "none" });
      await reg.update().catch(() => {});
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
      // Only switch sites to Ultraviolet after it really loads a page; any
       // failure leaves websites closed until the user retries.
      return await probeUltraviolet();
    } catch {
      setupPromise = null;
      return false;
    }
  })().then((ok) => { if (!ok) setupPromise = null; return ok; });
  return setupPromise;
}

/** Pages served by hosting instead of the proxied site (stale worker or cache). */
export function isHostingErrorPage(text: string | null | undefined): boolean {
  return /deployment storage temporarily unavailable/i.test(text ?? "");
}

/** Turn Ultraviolet off for this session and remove its worker. */
export async function resetUltraviolet(): Promise<void> {
  setupPromise = null;
  try {
    for (const reg of await navigator.serviceWorker.getRegistrations()) {
      if (reg.scope.includes(UV_PREFIX)) await reg.unregister();
    }
  } catch { /* nothing to remove */ }
}
