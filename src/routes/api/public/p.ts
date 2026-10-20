import { createFileRoute } from "@tanstack/react-router";

import { applyBrowserHeaders, upstreamReferer } from "@/lib/proxy-compatibility";
import { applySearchPolicy, isDuckDuckGo, safeSearchEnabled } from "@/lib/browser-policy";

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
  "cross-origin-resource-policy",
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
    let name: string;
    try { name = decodeURIComponent(trimmed.slice(prefix.length, eq)); } catch { continue; }
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
  function SS(v){return String(v).replace(/(\\S+)(\\s+[^,]+)?(\\s*,|$)/g,function(_m,u,d,c){return P(u)+(d||'')+(c||'')})}
  function CSS(v){return String(v).replace(/url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/gi,function(_m,q,u){return 'url('+q+P(u)+q+')'})}
  function notify(type,url){parent.postMessage({__radium:type,url:url},location.origin)}
  window.__radiumProxy=P;
  var f=window.fetch;
  window.fetch=function(i,o){ if(typeof i==='string')return f(P(i),o);
    if(i&&i.url)return f(new Request(P(i.url),i),o); return f(i,o); };
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);a[1]=P(u);return xo.apply(this,a)};
  var hp=history.pushState,hr=history.replaceState;
  history.pushState=function(s,t,u){var result=hp.call(this,s,t,u==null?u:P(String(u)));if(u!=null){B=U(String(u));notify('loaded',B)}return result};
  history.replaceState=function(s,t,u){var result=hr.call(this,s,t,u==null?u:P(String(u)));if(u!=null){B=U(String(u));notify('loaded',B)}return result};
  var ws=window.WebSocket;
  if(ws){window.WebSocket=function(u,p){try{var t=new URL(u,B);var s=location.protocol==='https:'?'wss:':'ws:';
    return new ws(s+'//'+location.host+'/api/public/p?ws=1&u='+encodeURIComponent(t.toString()),p)}catch(e){return new ws(u,p)}};
    window.WebSocket.prototype=ws.prototype;}
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.hasAttribute('download'))return;var h=a.getAttribute('href')||'';
    if(/^(javascript:|#|mailto:|tel:)/i.test(h))return;
    e.preventDefault();
    var abs=U(h);
    if(parent!==window&&parent===top)notify('navigate',abs);else location.href=P(abs);
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
    if(parent!==window&&parent===top)notify('navigate',action.toString());else location.href=P(action.toString());
  },true);
  // Elements created or mutated by page scripts never went through the server
  // rewrite, so their raw URLs escaped the proxy and 404'd.
  var sa=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(n,v){
    try{if(/^(src|href|action|poster|formaction|data-src)$/i.test(n)&&typeof v==='string'&&v)v=P(v);else if(/^(srcset|imagesrcset|data-srcset)$/i.test(n))v=SS(v);else if(n.toLowerCase()==='style')v=CSS(v)}catch(e){}
    return sa.call(this,n,v)};
  function prop(proto,name,convert){if(!proto)return;var d=Object.getOwnPropertyDescriptor(proto,name);if(!d||!d.set||!d.get||!d.configurable)return;
    Object.defineProperty(proto,name,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){return d.set.call(this,convert(v))}})}
  [[window.HTMLImageElement,'src'],[window.HTMLImageElement,'srcset'],[window.HTMLSourceElement,'src'],[window.HTMLSourceElement,'srcset'],[window.HTMLScriptElement,'src'],[window.HTMLLinkElement,'href'],[window.HTMLIFrameElement,'src'],[window.HTMLMediaElement,'src'],[window.HTMLVideoElement,'poster'],[window.HTMLAnchorElement,'href'],[window.HTMLFormElement,'action']].forEach(function(pair){if(pair[0])prop(pair[0].prototype,pair[1],pair[1]==='srcset'?SS:P)});
  prop(CSSStyleDeclaration.prototype,'backgroundImage',CSS);
  var sp=CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty=function(n,v,p){return sp.call(this,n,CSS(v),p)};
  function fix(el){if(!el||el.nodeType!==1)return;['src','href','action','poster','data-src','srcset','imagesrcset','data-srcset','style'].forEach(function(n){var v=el.getAttribute(n);if(!v)return;var next=n==='style'?CSS(v):/srcset$/.test(n)?SS(v):P(v);if(next!==v)sa.call(el,n,next)})}
  new MutationObserver(function(records){records.forEach(function(r){if(r.type==='attributes')fix(r.target);else r.addedNodes.forEach(function(n){fix(n);if(n.querySelectorAll)n.querySelectorAll('[src],[href],[srcset],[style],[data-src]').forEach(fix)})})}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','srcset','style','data-src','data-srcset']});
  window.addEventListener('load',function(){notify('loaded',B)});
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
    .replace(/\sstyle=("([^"]*)"|'([^']*)')/gi, (_m, _raw, dq, sq) => {
      const quote = dq !== undefined ? '"' : "'";
      return ` style=${quote}${rewriteCss(decodeAttrEntities(dq ?? sq ?? ""), base, stealth)}${quote}`;
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
  let target = url.searchParams.get("u");
  const stealth = url.searchParams.get("stealth") === "1";
  // Pages sometimes drop the ?u= (relative form actions, stripped links):
  // rebuild the target from the proxied page that sent the request.
  if (!target) {
    const from = upstreamReferer(request.headers.get("referer"));
    if (from) target = new URL(url.search || "/", from).href;
  }
  if (!target) return Response.redirect(new URL("/", url).href, 302);

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid target URL", { status: 400 });
  }
  // DuckDuckGo result links are redirect wrappers; jump straight to the site.
  if (isDuckDuckGo(targetUrl) && targetUrl.pathname.startsWith("/l/")) {
    const real = targetUrl.searchParams.get("uddg");
    if (real) { try { const next = new URL(real); if (/^https?:$/.test(next.protocol)) return Response.redirect(new URL(proxyPath(next.href, stealth), url).href, 302); } catch { /* fall through */ } }
  }
  if (!/^https?:$/.test(targetUrl.protocol)) {
    return new Response("Only http/https targets are supported", { status: 400 });
  }

  let safe = true;
  if (isDuckDuckGo(targetUrl)) {
    try {
      const { requireUser } = await import("@/lib/account-session.server");
      const user = await requireUser();
      const preferences = user.settings as { settings?: { duckduckgoSafeSearch?: boolean } } | null;
      safe = safeSearchEnabled(user.role, preferences?.settings?.duckduckgoSafeSearch);
    } catch { /* Signed-out requests always receive strict search. */ }
    targetUrl = applySearchPolicy(targetUrl, safe);
  }

  const isYouTube = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(targetUrl.hostname);
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
  const scope = cookieScope(targetUrl.hostname);
  const cookie = request.headers.get("cookie");
  headers.delete("cookie");
  if (cookie) {
    const upstreamCookie = upstreamCookieHeader(cookie, scope);
    if (upstreamCookie) headers.set("cookie", upstreamCookie);
  }
  if (isDuckDuckGo(targetUrl)) {
    const jar = (headers.get("cookie") ?? "").split(";").filter((part) => !/^\s*(kp|safe|safesearch)=/i.test(part));
    jar.push(`kp=${safe ? "1" : "-2"}`);
    headers.set("cookie", jar.filter(Boolean).join("; "));
  }
  // Optional operator session applies only to YouTube, never other sites.
  if (isYouTube) {
    const session = sessionCookie(process.env["YOUTUBE_SESSION_COOKIE"]);
    if (session) headers.set("cookie", [headers.get("cookie"), session].filter(Boolean).join("; "));
  }
  applyBrowserHeaders(request.headers, headers);
  const referringPage = upstreamReferer(request.headers.get("referer"));
  if (referringPage) {
    const ref = new URL(referringPage);
    headers.set("referer", ref.origin === targetUrl.origin ? ref.href : ref.origin + "/");
  }
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
  outHeaders.set("cache-control", "private, no-store");
  // Static, cookie-free resources can be reused by this browser, never a shared cache.
  const contentType = upstream.headers.get("content-type") ?? "";
  if (request.method === "GET" && upstream.ok && !headers.has("cookie") && !upstream.headers.has("set-cookie") && !isDuckDuckGo(targetUrl) && /^(image\/|font\/|text\/css)/i.test(contentType)) {
    outHeaders.set("cache-control", "private, max-age=300");
  }
  if (/text\/(html|css)/i.test(contentType)) { outHeaders.delete("etag"); outHeaders.delete("last-modified"); }

  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie") ?? ""] : []);
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
    outHeaders.set("cache-control", "private, no-store");
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
