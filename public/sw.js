/**
 * Basic Service Worker for PWA installability.
 * Provides a fetch handler so the app meets PWA installation criteria.
 */

const CACHE_NAME = "dabys-v1";

self.addEventListener("install", (event) => {
  // Skip waiting so the new SW activates immediately when ready
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all clients
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first: try network, fall back to cache only for same-origin navigation if needed
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
    );
    return;
  }
  // For other requests, use network only (no caching by default)
  event.respondWith(fetch(event.request));
});
