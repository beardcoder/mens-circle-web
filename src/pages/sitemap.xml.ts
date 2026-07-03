import type { APIRoute } from 'astro';
import { listPublishedEventSlugs } from '@lib/server/events';

// SSR (not prerendered): the previous @astrojs/sitemap output was never served
// in production — the Bun adapter builds its static-file manifest by walking
// dist/client during `astro:build:done`, but the sitemap integration writes its
// files in the same hook and loses the race, so `sitemap-index.xml` 404'd and
// Google could not read it. It also listed `/admin/*` (noindex, behind auth)
// and could not list the SSR event pages at all.
//
// Rendering the sitemap as a real route fixes both: it is always served, lists
// only indexable public pages with canonical (no trailing slash) URLs, and
// pulls the live event pages straight from the DB.
export const prerender = false;

// Public, indexable pages. Deliberately excludes the noindex legal pages
// (/impressum, /datenschutz), the noindex full-screen breathing app
// (/atemuebung/app), and everything under /admin and /api.
const STATIC_PATHS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/warum-ich-den-maennerkreis-leite', changefreq: 'monthly', priority: '0.8' },
  { path: '/event', changefreq: 'weekly', priority: '0.9' },
  { path: '/atemuebung', changefreq: 'monthly', priority: '0.6' },
  { path: '/teile-deine-erfahrung', changefreq: 'yearly', priority: '0.4' },
];

const xmlEscape = (value: string): string =>
  value.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://mens-circle.de')).origin;

  type Entry = { loc: string; lastmod?: string; changefreq?: string; priority?: string };
  const entries: Entry[] = STATIC_PATHS.map(({ path, changefreq, priority }) => ({
    loc: `${origin}${path}`,
    changefreq,
    priority,
  }));

  // One indexable page per published event, straight from the live DB.
  try {
    const events = await listPublishedEventSlugs();
    for (const { slug, updatedAt } of events) {
      entries.push({
        loc: `${origin}/event/${encodeURIComponent(slug)}`,
        lastmod: updatedAt ? new Date(updatedAt).toISOString() : undefined,
        changefreq: 'weekly',
        priority: '0.7',
      });
    }
  } catch {
    // A DB hiccup must not take the sitemap down — serve the static pages.
  }

  const urls = entries
    .map(({ loc, lastmod, changefreq, priority }) => {
      const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
      if (priority) parts.push(`    <priority>${priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
