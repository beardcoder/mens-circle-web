/** Tiny helpers shared by the API endpoints. */

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Read a JSON body, tolerating an empty / non-JSON body. */
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Checkbox / boolean coercion matching the former PocketBase routes. */
export function isTruthy(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/** A honeypot "website" field is non-empty → treat as a bot. */
export function isBot(data: Record<string, unknown>): boolean {
  return typeof data.website === 'string' && data.website.trim() !== '';
}
