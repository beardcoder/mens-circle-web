// Retires the service worker of the removed breathing app (/atemuebung/app).
// Browsers that installed it re-check this URL on their next visit, pick this
// version up, drop its caches and unregister. Added 2026-10-26; delete this file
// (and its note in docs/runtime.md) after 2027-04-26, once old installs have updated.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('mk-breath-')) await caches.delete(key);
      }
      await self.registration.unregister();
    })(),
  );
});
