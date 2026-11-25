/**
 * Calls a public route of the site's EmDash plugin (src/plugin) from server code: the
 * Astro Actions and the cancel page. EmDash hands anonymous requests only this door
 * for writes (`locals.emdash.handlePublicPluginApiRoute`), so the forms keep their
 * actions (rate limit, honeypot, the no-JS answer) and the plugin does the writing.
 */
import type { APIContext } from 'astro'

/** A refusal the plugin worded for the visitor, with its HTTP status. */
export class PluginRefusal extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** Codes whose message the plugin wrote for the visitor; anything else is internal. */
const VISITOR_FACING = new Set(['NOT_FOUND', 'CONFLICT'])

export async function callPlugin<T>(
  locals: APIContext['locals'],
  route: string,
  input: Record<string, unknown>,
): Promise<T> {
  const handle = locals.emdash?.handlePublicPluginApiRoute

  if (!handle) throw new Error('EmDash runtime is not available')

  const request = new Request(`http://plugin.invalid/_emdash/api/plugins/mens-circle/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  const result = await handle('mens-circle', 'POST', route, request)

  if (result.success) return result.data as T

  if (result.error && VISITOR_FACING.has(result.error.code)) {
    throw new PluginRefusal(result.error.message, result.status ?? 400)
  }

  throw new Error(`plugin route ${route} failed: ${result.error?.code ?? 'unknown'}`)
}
