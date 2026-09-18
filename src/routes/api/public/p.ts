import { createFileRoute } from "@tanstack/react-router";

const STEALTH_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

const DEFAULT_AGENT = STEALTH_AGENTS[0]!;

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
]);

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

function resolveAndProxy(raw: string, base: string, stealth: boolean): string {
  const value = raw.trim();
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
  function P(u){try{if(typeof u!=='string')u=String(u);if(!u)return u;
    if(/^(data:|blob:|javascript:|about:|mailto:|tel:)/i.test(u))return u;
    if(u.indexOf('/api/public/p?u=')===0)return u;
    return '/api/public/p?u='+encodeURIComponent(new URL(u,B).toString())+(S?'&stealth=1':'');
  }catch(e){return u}}
  window.__radiumProxy=P;
  var f=window.fetch;
  window.fetch=function(i,o){ if(typeof i==='string')return f(P(i),o);
    if(i&&i.url)return f(new Request(P(i.url),i),o); return f(i,o); };
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);a[1]=P(u);return xo.apply(this,a)};
  var ws=window.WebSocket;
  if(ws){window.WebSocket=function(u,p){try{var t=new URL(u,B);var s=location.protocol==='https:'?'wss:':'ws:';
    return new ws(s+'//'+location.host+'/api/public/p?ws=1&u='+encodeURIComponent(t.toString()),p)}catch(e){return new ws(u,p)}};
    window.WebSocket.prototype=ws.prototype;}
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!a)return;var h=a.getAttribute('href')||'';
    if(/^(javascript:|#|mailto:|tel:)/i.test(h))return;
    e.preventDefault();
    var abs=new URL(h,B).toString();
    parent.postMessage({__radium:'navigate',url:abs},'*');
    location.href=P(abs);
  },true);
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

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    "user-agent",
    stealth
      ? (STEALTH_AGENTS[Math.floor(Math.random() * STEALTH_AGENTS.length)] ?? DEFAULT_AGENT)
      : (request.headers.get("user-agent") ?? DEFAULT_AGENT),
  );
  headers.set("accept-language", headers.get("accept-language") ?? "en-SG,en;q=0.9");
  headers.set("referer", targetUrl.origin + "/");
  headers.delete("accept-encoding");

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? null
          : ((request.body ?? null) as BodyInit | null),
      redirect: "follow",
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

  const location = upstream.headers.get("location");
  if (location) {
    outHeaders.set("location", resolveAndProxy(location, upstream.url || targetUrl.toString(), stealth));
  }

  const type = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const base = upstream.url || targetUrl.toString();

  if (type.includes("text/html")) {
    const body = rewriteHtml(await upstream.text(), base, stealth);
    outHeaders.set("content-type", "text/html; charset=utf-8");
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

export const Route = createFileRoute("/api/public/p")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      HEAD: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
