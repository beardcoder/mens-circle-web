/**
 * Tombstone service worker.
 *
 * The breathing-app PWA (offline + installability) was removed. This file stays
 * so browsers that still have the old service worker registered fetch it on
 * their next update check, then unregister it and purge its caches — leaving the
 * site under no service worker. Without this self-destruct, a missing /sw.js
 * (404) would NOT remove the old worker; it would keep controlling the origin.
 *
 * Safe to delete once enough time has passed that returning visitors have all
 * updated (a release cycle or two).
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
