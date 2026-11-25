/** The sitemap index lives at /sitemap-index.xml; this route also keeps EmDash's own /sitemap.xml out. */
import type { APIRoute } from 'astro'

export const prerender = false

export const GET: APIRoute = ({ redirect }) => redirect('/sitemap-index.xml', 301)
