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

export type UvFailure = "private-mode" | "unsupported" | "storage" | "relay" | "transport" | "register" | "activate" | "probe";
export type UvSetup = { ok: boolean; reason?: UvFailure };

let setupPromise: Promise<UvSetup> | null = null;
let setupServer: string | null = null;

/** Bound worker operations that otherwise retry forever on a suspended device. */
async function within<T>(operation: Promise<T>, step: UvFailure, timeoutMs = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new UvStepError(step)), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

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

async function attemptSetup(wispServer: string): Promise<UvSetup> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return { ok: false, reason: "private-mode" };
    if (typeof SharedWorker === "undefined" || typeof BroadcastChannel === "undefined") return { ok: false, reason: "unsupported" };
    try {
      const key = "radium-uv-storage-check";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
    } catch { return { ok: false, reason: "storage" }; }
    // Ultraviolet depends on an outside Wisp relay; when it is unreachable
    // every site fails, so only use Ultraviolet when the relay answers.
    if (!(await wispReachable(wispServer))) return { ok: false, reason: "relay" };
    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    try {
      const connection = new BareMuxConnection("/baremux/worker.js");
      await within(connection.setTransport("/libcurl/index.mjs", [{ wisp: wispServer }]), "transport");
    } catch { return { ok: false, reason: "transport" }; }
    // uv.sw.js is only the library; /uv/sw.js is the entry that wires it up.
    // Devices that visited older versions can still hold outdated workers;
    // drop anything that isn't the current entry and refresh the rest.
    for (const old of await navigator.serviceWorker.getRegistrations()) {
      const script = (old.active ?? old.waiting ?? old.installing)?.scriptURL ?? "";
      if (old.scope.includes(UV_PREFIX) && !script.endsWith("/uv/sw.js")) await old.unregister();
    }
    const reg = await navigator.serviceWorker.register("/uv/sw.js", { scope: UV_PREFIX, updateViaCache: "none" }).catch(() => null);
    if (!reg) return { ok: false, reason: "register" };
    await within(reg.update(), "register").catch(() => {});
    // The Radium page sits outside the worker's scope, so serviceWorker.ready
    // never resolves here; wait for this registration to activate instead.
    const worker = reg.active ?? reg.installing ?? reg.waiting;
    if (!worker) return { ok: false, reason: "activate" };
    if (worker.state !== "activated") {
      const activated = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 10000);
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") { clearTimeout(timer); resolve(true); }
          if (worker.state === "redundant") { clearTimeout(timer); resolve(false); }
        });
      });
      if (!activated) return { ok: false, reason: "activate" };
    }
    // Only switch sites to Ultraviolet after it really loads a page; any
    // failure leaves websites closed until the user retries.
    return (await probeUltraviolet()) ? { ok: true } : { ok: false, reason: "probe" };
  } catch (error) {
    return { ok: false, reason: error instanceof UvStepError ? error.step : "register" };
  }
}

class UvStepError extends Error {
  constructor(public step: UvFailure) { super(step); }
}

export function setupUltraviolet(wispServer: string): Promise<UvSetup> {
  if (setupPromise && setupServer === wispServer) return setupPromise;
  const previous = setupPromise;
  setupServer = wispServer;
  setupPromise = (async () => {
    // Serialize relay changes so a late initialization cannot replace the new transport.
    if (previous) await previous.catch(() => {});
    const first = await within(attemptSetup(wispServer), "transport", 40000).catch((error) => ({ ok: false, reason: error instanceof UvStepError ? error.step : "transport" } as UvSetup));
    if (first.ok) return first;
    // A stuck or stale worker is the usual device-specific failure (seen on
    // iPad Home Screen apps): wipe it once and try again from scratch.
    if (first.reason === "probe" || first.reason === "activate" || first.reason === "register") {
      await resetUltraviolet(false);
      return within(attemptSetup(wispServer), "transport", 40000).catch(() => ({ ok: false, reason: "transport" } as UvSetup));
    }
    return first;
  })().then((result) => { if (!result.ok && setupServer === wispServer) setupPromise = null; return result; });
  return setupPromise;
}

/** Pages served by hosting instead of the proxied site (stale worker or cache). */
export function isHostingErrorPage(text: string | null | undefined): boolean {
  return /deployment storage temporarily unavailable|ultraviolet is not connected/i.test(text ?? "");
}

/** Turn Ultraviolet off and remove its worker. */
export async function resetUltraviolet(clearSetup = true): Promise<void> {
  if (clearSetup) { setupPromise = null; setupServer = null; }
  try {
    for (const reg of await navigator.serviceWorker.getRegistrations()) {
      if (reg.scope.includes(UV_PREFIX)) await reg.unregister();
    }
  } catch { /* nothing to remove */ }
}
