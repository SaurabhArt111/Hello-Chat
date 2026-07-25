/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// Injected at build time by vite-plugin-pwa (injectManifest strategy).
precacheAndRoute(self.__WB_MANIFEST);

// Uploaded chat media: cache-first once fetched (see vite.config.js for
// the equivalent generateSW config this replaces).
registerRoute(
  ({ url }) => url.pathname.startsWith("/uploads/"),
  new CacheFirst({
    cacheName: "uploaded-media",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// API calls: network-first with a short cache fallback.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 6,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })],
  })
);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/**
 * Background push handling - this is what lets HelloChat "ring"/notify a
 * user for incoming calls, missed calls, and (optionally) new messages
 * even when the app isn't open. The browser/OS shows this using its own
 * system notification (and, on most platforms, the device's default
 * notification sound) - we don't need to (and can't) play a custom audio
 * file from here.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "HelloChat", body: event.data.text() };
  }

  const {
    title = "HelloChat",
    body = "",
    icon = "/pwa-icons/icon-192.png",
    tag,
    data = {},
    requireInteraction = false,
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/pwa-icons/icon-64.png",
      tag,
      data,
      requireInteraction,
      vibrate: data.kind === "incoming_call" ? [300, 200, 300, 200, 300] : [100],
      renotify: !!tag,
    })
  );
});

/** Clicking a notification focuses (or opens) the app instead of just dismissing it. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/home";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
