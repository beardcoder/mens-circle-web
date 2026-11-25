/**
 * The event pages, listed at request time. EmDash's own `/sitemap-[collection].xml`
 * lists only collections with its SEO panel, which the events do not use.
 */
import type { APIRoute } from 'astro'
import { getEmDashCollection } from 'emdash'

import { PUBLIC_CACHE } from '@lib/server/public-data'
import { escapeHtml } from '@lib/shared/html'

export const prerender = false

/** W3C-datetime for `<lastmod>`; falls back to the raw value if unparseable. */
const lastmod = (value: unknown): string => {
  const d = new Date(value instanceof Date ? value : String(value))

  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export const GET: APIRoute = async ({ site, cache }) => {
  const { entries, error } = await getEmDashCollection('events', { orderBy: { starts_at: 'desc' }, limit: 1000 })

  if (error) return new Response('unavailable', { status: 503, headers: { 'cache-control': 'no-store' } })

  // Every published event page, past ones included (the sitemap is their only link).
  const events = entries.map(({ id, data }) => ({ slug: String(data.slug ?? id), updatedAt: data.updatedAt }))

  cache.set(PUBLIC_CACHE)

  const urls = events
    .map((event) => {
      // An unescaped `&` from a hand-set slug would make the whole document unparseable.
      const loc = escapeHtml(new URL(`/event/${event.slug}`, site).href)

      return `<url><loc>${loc}</loc><lastmod>${lastmod(event.updatedAt)}</lastmod></url>`
    })
    .join('')

  // A urlset with no children is valid, so an empty calendar yields an empty
  // sitemap rather than a 404 the crawler logs as an error.
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // The route cache spares the database; crawlers may keep it an hour.
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
  })
}
