/// <reference path="../pb_data/types.d.ts" />

// Cache-Control for the static frontend served from pb_public.
// PocketBase's static handler sets Last-Modified but no Cache-Control, so the
// browser revalidates every asset on every navigation. This middleware adds
// sensible caching:
//   - /assets/*  (Astro content-hashed JS/CSS/fonts) → immutable, 1 year
//   - images / icons                                  → 7 days
//   - manifest / robots / sitemap                     → 1 day
//   - HTML & clean routes                             → always revalidate
// API (/api/*) and admin (/_/*) responses are left untouched (never cached).
routerUse((e) => {
  try {
    const req = e.request;
    const method = (req && req.method) || "GET";
    const path = (req && req.url && req.url.path) || "";

    // Only cache safe, idempotent reads of the static site.
    const isReadOnly = method === "GET" || method === "HEAD";
    const isAppRoute =
      path.indexOf("/api/") === 0 || path.indexOf("/_/") === 0;

    if (isReadOnly && !isAppRoute) {
      let cacheControl;
      if (path.indexOf("/assets/") === 0) {
        // Content-hashed Astro build assets (JS, CSS, bundled fonts).
        cacheControl = "public, max-age=31536000, immutable";
      } else if (/\.(?:woff2?|ttf|otf|eot)$/i.test(path)) {
        cacheControl = "public, max-age=31536000, immutable";
      } else if (/\.(?:png|jpe?g|gif|svg|webp|avif|ico)$/i.test(path)) {
        cacheControl = "public, max-age=604800"; // 7 days
      } else if (
        path === "/manifest.json" ||
        path === "/robots.txt" ||
        path === "/browserconfig.xml" ||
        /\.xml$/i.test(path)
      ) {
        cacheControl = "public, max-age=86400"; // 1 day
      } else {
        // HTML documents and clean routes (/, /event/, …): let the browser
        // cache but always revalidate so a new deploy shows immediately.
        cacheControl = "public, max-age=0, must-revalidate";
      }
      e.response.header().set("Cache-Control", cacheControl);
    }
  } catch (err) {
    $app.logger().error("cache-headers middleware failed", "error", String(err));
  }

  return e.next();
});
