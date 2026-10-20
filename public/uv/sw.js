/* Ultraviolet service worker entry: loads the runtime, then routes /uv/service/ requests. */
importScripts("/uv/uv.bundle.js", "/uv/uv.config.js", "/uv/uv.sw.js");

const uv = new UVServiceWorker();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(uv.route(event) ? uv.fetch(event) : fetch(event.request));
});
