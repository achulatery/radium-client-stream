import { createFileRoute } from "@tanstack/react-router";

/**
 * Authentic modern desktop browser identities. Mobile/Linux/old-Chrome strings
 * are what Google's bot heuristics score hardest, so the pool is desktop only
 * and each entry ships matching client hints.
 */
const DESKTOP_AGENTS: { ua: string; hints: Record<string, string> }[] = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    hints: {
      "sec-ch-ua": '"Chromium";v="141", "Not;A=Brand";v="24", "Google Chrome";v="141"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
    hints: {
      "sec-ch-ua": '"Chromium";v="140", "Not;A=Brand";v="24", "Microsoft Edge";v="140"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    hints: {
      "sec-ch-ua": '"Chromium";v="141", "Not;A=Brand";v="24", "Google Chrome";v="141"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    },
  },
];

const DEFAULT_AGENT = DESKTOP_AGENTS[0]!;

/** Headers that would expose the data-center hop to Google's security systems. */
const PROXY_FINGERPRINT_HEADERS = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "forwarded",
  "via",
  "x-radium-proxied",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "cdn-loop",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "x-request-id",
];

/** Cookie names accepted from the operator-supplied YouTube session string. */
const SESSION_COOKIE_NAMES = [
  "SID",
  "HSID",
  "SSID",
  "SAPISID",
  "APISID",
  "__Secure-1PSID",
  "__Secure-3PSID",
  "__Secure-1PAPISID",
  "__Secure-3PAPISID",
  "LOGIN_INFO",
  "VISITOR_INFO1_LIVE",
  "PREF",
];

/** Parse and whitelist a pasted "SID=...; HSID=...; SAPISID=..." string. */
function sessionCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const out: string[] = [];
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!value) continue;
    if (SESSION_COOKIE_NAMES.some((n) => n.toLowerCase() === name.toLowerCase())) {
      out.push(`${name}=${value}`);
    }
  }
  return out.length ? out.join("; ") : null;
}

/** youtube.com/watch?v=ID, /shorts/ID, youtu.be/ID -> nocookie embed URL. */
function youtubeEmbedTarget(url: URL): URL | null {
  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const valid = (id: string | null | undefined) => (id && /^[\w-]{6,20}$/.test(id) ? id : null);
  let id: string | null = null;
  if (host === "youtu.be") id = valid(parts[0]);
  else if (host === "youtube.com" && url.pathname === "/watch") id = valid(url.searchParams.get("v"));
  else if (host === "youtube.com" && (parts[0] === "shorts" || parts[0] === "live")) id = valid(parts[1]);
  if (!id) return null;
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  embed.searchParams.set("autoplay", "1");
  embed.searchParams.set("rel", "0");
  embed.searchParams.set("playsinline", "1");
  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (t) embed.searchParams.set("start", t.replace(/[^0-9]/g, "") || "0");
  return embed;
}


const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "strict-transport-security",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "report-to",
  "set-cookie",
]);

/** Group cookies by registrable domain so each site only gets its own jar. */
function cookieScope(hostname: string) {
  const parts = hostname.toLowerCase().split(".");
  const key = parts.length > 2 ? parts.slice(-2).join(".") : hostname.toLowerCase();
  return key.replace(/[^a-z0-9]/g, "_");
}

/** Upstream cookies are re-issued for our own origin, scoped by site. */
function rewriteSetCookie(raw: string, scope: string) {
  const [pair, ...attrs] = raw.split(";");
  if (!pair || !pair.includes("=")) return null;
  const eq = pair.indexOf("=");
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return null;
  const kept = attrs
    .map((a) => a.trim())
    .filter((a) => /^(expires|max-age|httponly)/i.test(a));
  return [`rdm_${scope}__${encodeURIComponent(name)}=${value}`, "Path=/", "SameSite=Lax", ...kept].join("; ");
}

/** Reverse of rewriteSetCookie: hand a site back only the cookies it set. */
function upstreamCookieHeader(cookieHeader: string, scope: string) {
  const prefix = `rdm_${scope}__`;
  const out: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const name = decodeURIComponent(trimmed.slice(prefix.length, eq));
    out.push(`${name}=${trimmed.slice(eq + 1)}`);
  }
  return out.join("; ");
}

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "range",
  "content-type",
  "cookie",
  "if-none-match",
  "if-modified-since",
];

function proxyPath(target: string, stealth: boolean) {
  return `/api/public/p?u=${encodeURIComponent(target)}${stealth ? "&stealth=1" : ""}`;
}

/** Browsers decode entities in attribute values; we must too, before wrapping. */
function decodeAttrEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function resolveAndProxy(raw: string, base: string, stealth: boolean): string {
  const value = decodeAttrEntities(raw.trim());
  if (!value) return raw;
  if (/^(data:|blob:|javascript:|mailto:|tel:|about:|#)/i.test(value)) return value;
  if (value.startsWith("/api/public/p?u=")) return value;
  try {
    return proxyPath(new URL(value, base).toString(), stealth);
  } catch {
    return raw;
  }
}

function rewriteSrcset(value: string, base: string, stealth: boolean) {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const [url, ...rest] = trimmed.split(/\s+/);
      return [resolveAndProxy(url ?? "", base, stealth), ...rest].join(" ");
    })
    .join(", ");
}

function rewriteCss(css: string, base: string, stealth: boolean) {
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, q, url) => {
      return `url(${q}${resolveAndProxy(url, base, stealth)}${q})`;
    })
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (_m, q, url) => {
      return `@import ${q}${resolveAndProxy(url, base, stealth)}${q}`;
    });
}

const CLIENT_PATCH = `<script>(function(){
  var B=document.currentScript.getAttribute('data-base');
  var S=document.currentScript.getAttribute('data-stealth')==='1';
  function U(u){try{if(typeof u!=='string')u=String(u);var x=new URL(u,location.origin);
    if(x.origin===location.origin&&x.pathname==='/api/public/p'){var t=x.searchParams.get('u');if(t)return t}
    return new URL(u,B).toString();
  }catch(e){return u}}
  function P(u){try{if(typeof u!=='string')u=String(u);if(!u)return u;
    if(/^(data:|blob:|javascript:|about:|mailto:|tel:)/i.test(u))return u;
    var x=new URL(u,location.origin);
    if(x.origin===location.origin&&x.pathname==='/api/public/p'&&x.searchParams.has('u'))return x.pathname+x.search;
    return '/api/public/p?u='+encodeURIComponent(U(u))+(S?'&stealth=1':'');
  }catch(e){return u}}
  window.__radiumProxy=P;
  // Automation fingerprint hiding: headless/driver tells that Google scores.
  try{Object.defineProperty(navigator,'webdriver',{get:function(){return false},configurable:true})}catch(e){}
  try{if(!navigator.languages||!navigator.languages.length)Object.defineProperty(navigator,'languages',{get:function(){return['en-SG','en']}})}catch(e){}
  try{if(!(navigator.plugins&&navigator.plugins.length))Object.defineProperty(navigator,'plugins',{get:function(){return[1,2,3]}})}catch(e){}
  try{delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol}catch(e){}
  var f=window.fetch;
  window.fetch=function(i,o){ if(typeof i==='string')return f(P(i),o);
    if(i&&i.url)return f(new Request(P(i.url),i),o); return f(i,o); };
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);a[1]=P(u);return xo.apply(this,a)};
  var hp=history.pushState,hr=history.replaceState;
  history.pushState=function(s,t,u){return hp.call(this,s,t,u==null?u:P(String(u)))};
  history.replaceState=function(s,t,u){return hr.call(this,s,t,u==null?u:P(String(u)))};
  var ws=window.WebSocket;
  if(ws){window.WebSocket=function(u,p){try{var t=new URL(u,B);var s=location.protocol==='https:'?'wss:':'ws:';
    return new ws(s+'//'+location.host+'/api/public/p?ws=1&u='+encodeURIComponent(t.toString()),p)}catch(e){return new ws(u,p)}};
    window.WebSocket.prototype=ws.prototype;}
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!a)return;var h=a.getAttribute('href')||'';
    if(/^(javascript:|#|mailto:|tel:)/i.test(h))return;
    e.preventDefault();
    var abs=U(h);
    parent.postMessage({__radium:'navigate',url:abs},'*');
    location.href=P(abs);
  },true);
  document.addEventListener('submit',function(e){
    var f=e.target;if(!f||f.tagName!=='FORM')return;
    var method=(f.getAttribute('method')||'get').toLowerCase();
    if(method!=='get')return;
    e.preventDefault();
    var action=new URL(U(f.getAttribute('action')||B));
    var data=new FormData(f);
    var keys=[];data.forEach(function(_v,k){if(keys.indexOf(k)<0)keys.push(k)});
    keys.forEach(function(k){action.searchParams.delete(k)});
    data.forEach(function(v,k){if(typeof v==='string')action.searchParams.append(k,v)});
    parent.postMessage({__radium:'navigate',url:action.toString()},'*');
    location.href=P(action.toString());
  },true);
  // Elements created or mutated by page scripts never went through the server
  // rewrite, so their raw URLs escaped the proxy and 404'd.
  var sa=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(n,v){
    try{if(/^(src|href|action|poster|formaction)$/i.test(n)&&typeof v==='string'&&v)v=P(v)}catch(e){}
    return sa.call(this,n,v)};
  window.addEventListener('load',function(){parent.postMessage({__radium:'loaded',url:B},'*')});
})();</script>`;

function rewriteHtml(html: string, base: string, stealth: boolean) {
  let out = html
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/\s(integrity|nonce)=("[^"]*"|'[^']*')/gi, "")
    .replace(
      /\s(href|src|action|formaction|poster|data-src)=("([^"]*)"|'([^']*)')/gi,
      (_m, attr: string, _raw: string, dq?: string, sq?: string) => {
        const value = dq ?? sq ?? "";
        const quote = dq !== undefined ? '"' : "'";
        return ` ${attr}=${quote}${resolveAndProxy(value, base, stealth)}${quote}`;
      },
    )
    .replace(/\s(srcset|imagesrcset)=("([^"]*)"|'([^']*)')/gi, (_m, attr, _raw, dq, sq) => {
      const value = (dq ?? sq ?? "") as string;
      const quote = dq !== undefined ? '"' : "'";
      return ` ${attr}=${quote}${rewriteSrcset(value, base, stealth)}${quote}`;
    })
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_m, attrs, css) => {
      return `<style${attrs}>${rewriteCss(css as string, base, stealth)}</style>`;
    });

  const patch = CLIENT_PATCH.replace(
    "<script>",
    `<script data-base="${base.replace(/"/g, "&quot;")}" data-stealth="${stealth ? "1" : "0"}">`,
  );
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, (m) => `${m}${patch}`);
  } else {
    out = patch + out;
  }
  return out;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  const stealth = url.searchParams.get("stealth") === "1";
  if (!target) return new Response("Missing ?u= target URL", { status: 400 });

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid target URL", { status: 400 });
  }
  if (!/^https?:$/.test(targetUrl.protocol)) {
    return new Response("Only http/https targets are supported", { status: 400 });
  }

  const isYouTube = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(targetUrl.hostname);
  const isGoogle = /(?:^|\.)google\.[a-z.]+$/i.test(targetUrl.hostname);
  // Watch pages carry the heaviest bot checks (PoToken, "not a bot" wall); the
  // embed endpoint serves the same player context with far fewer checks.
  if (isYouTube) {
    const embedded = youtubeEmbedTarget(targetUrl);
    if (embedded) targetUrl = embedded;
    // YouTube derives region from the requesting IP, which is whatever edge node
    // handled the fetch (seen as NL, US, ...). Pin it with explicit hints.
    if (!targetUrl.searchParams.has("gl")) targetUrl.searchParams.set("gl", "SG");
    if (!targetUrl.searchParams.has("hl")) targetUrl.searchParams.set("hl", "en");
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Never let a data-center hop signature reach the upstream site.
  for (const name of PROXY_FINGERPRINT_HEADERS) headers.delete(name);
  const scope = cookieScope(targetUrl.hostname);
  const cookie = request.headers.get("cookie");
  headers.delete("cookie");
  if (cookie) {
    const upstreamCookie = upstreamCookieHeader(cookie, scope);
    if (upstreamCookie) headers.set("cookie", upstreamCookie);
  }
  // Google/YouTube otherwise bounce every fresh session to a consent page on
  // accounts.google.com, whose in-page navigation is what produced 404s.
  if (isYouTube || isGoogle) {
    const existing = headers.get("cookie") ?? "";
    const extras: string[] = [];
    if (!/\bSOCS=/.test(existing)) extras.push("SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg");
    if (!/\bCONSENT=/.test(existing)) extras.push("CONSENT=YES+cb");
    // YouTube's own region preference; keeps the site on Singapore even when
    // the edge IP geolocates elsewhere.
    if (isYouTube && !/\bPREF=/.test(existing)) extras.push("PREF=gl=SG&hl=en");
    // Operator-supplied signed-in session (SID/HSID/SAPISID/...). A real
    // account session is the strongest signal against YouTube's bot checks.
    const session = sessionCookie(process.env["YOUTUBE_SESSION_COOKIE"]);
    if (session) extras.push(session);
    if (extras.length) headers.set("cookie", [existing, ...extras].filter(Boolean).join("; "));
  }

  // Always present as a real desktop browser: a random identity in stealth
  // mode, a stable one otherwise, with matching client hints.
  const identity =
    stealth || isYouTube || isGoogle
      ? (DESKTOP_AGENTS[Math.floor(Math.random() * DESKTOP_AGENTS.length)] ?? DEFAULT_AGENT)
      : DEFAULT_AGENT;
  headers.set("user-agent", identity.ua);
  for (const [k, v] of Object.entries(identity.hints)) headers.set(k, v);
  headers.set("accept-language", headers.get("accept-language") ?? "en-SG,en;q=0.9");
  headers.set("referer", targetUrl.origin + "/");
  if (request.method !== "GET" && request.method !== "HEAD") headers.set("origin", targetUrl.origin);
  headers.delete("accept-encoding");

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer(),
      // Manual: sign-in hands out its session cookies on the redirect hops, and
      // following them server-side would swallow those cookies.
      redirect: "manual",
    });
  } catch (error) {
    return new Response(`Upstream request failed: ${(error as Error).message}`, { status: 502 });
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) outHeaders.set(key, value);
  });
  outHeaders.set("x-radium-proxied", targetUrl.toString());
  outHeaders.set("access-control-allow-origin", "*");

  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : ((upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")!] : []) as string[]);
  for (const raw of setCookies) {
    const rewritten = rewriteSetCookie(raw, scope);
    if (rewritten) outHeaders.append("set-cookie", rewritten);
  }

  const location = upstream.headers.get("location");
  if (location) {
    const resolved = resolveAndProxy(location, upstream.url || targetUrl.toString(), stealth);
    outHeaders.set("location", resolved);
    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response(null, { status: upstream.status, headers: outHeaders });
    }
  }

  const type = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const base = upstream.url || targetUrl.toString();

  if (type.includes("text/html")) {
    const body = rewriteHtml(await upstream.text(), base, stealth);
    outHeaders.set("content-type", "text/html; charset=utf-8");
    outHeaders.set("referrer-policy", "same-origin");
    // Only the top proxied frame owns the navigation fallback. Nested frames
    // (Google consent/auth) are referred by a proxy URL; skip those so a later
    // escaped navigation still resolves against the real page.
    const referer = request.headers.get("referer") ?? "";
    let nestedFrame = false;
    try {
      nestedFrame = new URL(referer).pathname === "/api/public/p";
    } catch {
      nestedFrame = false;
    }
    if (!nestedFrame) {
      outHeaders.append(
        "set-cookie",
        `radium_base=${encodeURIComponent(baseForNavigation(base))}; Path=/; SameSite=Lax`,
      );
    }
    return new Response(body, { status: upstream.status, headers: outHeaders });
  }

  if (type.includes("text/css")) {
    const body = rewriteCss(await upstream.text(), base, stealth);
    return new Response(body, { status: upstream.status, headers: outHeaders });
  }

  if (type.includes("mpegurl") || targetUrl.pathname.endsWith(".m3u8")) {
    const manifest = (await upstream.text())
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          return trimmed.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${resolveAndProxy(uri, base, stealth)}"`);
        }
        return resolveAndProxy(trimmed, base, stealth);
      })
      .join("\n");
    return new Response(manifest, { status: upstream.status, headers: outHeaders });
  }

  // Binary / media: stream through untouched so Range + 206 responses keep working.
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

function baseForNavigation(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

export const Route = createFileRoute("/api/public/p")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      HEAD: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
