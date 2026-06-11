/// <reference path="../pb_data/types.d.ts" />

// Adds Cache-Control headers for the static frontend served from pb_public.
// PocketBase sets Last-Modified but no Cache-Control, causing the browser to
// revalidate every asset on every navigation. Strategy:
//
//   /assets/**          – Astro content-hashed JS/CSS/fonts → immutable, 1 year
//   fonts & images      – rarely change                     → 7 days
//   manifests & robots  – change infrequently               → 1 day
//   HTML & clean routes – must reflect new deploys          → always revalidate
//
// API (/api/*) and admin (/_/*) responses are never touched.

/** @param {string} path */
function getCacheControl(path) {
  if (path.startsWith("/assets/") || /\.(?:woff2?|ttf|otf|eot)$/i.test(path)) {
    return "public, max-age=31536000, immutable";
  }
  if (/\.(?:png|jpe?g|gif|svg|webp|avif|ico)$/i.test(path)) {
    return "public, max-age=604800"; // 7 days
  }
  if (/\.xml$/i.test(path) || path === "/manifest.json" || path === "/robots.txt" || path === "/browserconfig.xml") {
    return "public, max-age=86400"; // 1 day
  }
  return "public, max-age=0, must-revalidate";
}

routerUse((e) => {
  try {
    const method = e.request?.method ?? "GET";
    const path = e.request?.url?.path ?? "";

    const isStaticRead = (method === "GET" || method === "HEAD")
      && !path.startsWith("/api/")
      && !path.startsWith("/_/");

    if (isStaticRead) {
      e.response.header().set("Cache-Control", getCacheControl(path));
    }
  } catch (err) {
    $app.logger().error("cache-headers middleware failed", "error", String(err));
  }

  return e.next();
});
