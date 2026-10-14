import type { APIRoute } from 'astro';
import { GET as transform } from 'astro/assets/endpoint/node';

/**
 * Astro's `/_image` endpoint (the Node one: it reads the source from disk) with its
 * results kept in memory. Astro transforms on every request, and an AVIF takes
 * 1–3 s; the home page names a few dozen variants, so each is made once per process.
 * Requests for a variant in progress wait for it. Failures are not kept; at most
 * `MAX_ENTRIES` successes are, oldest out first.
 */

interface Result {
  status: number;
  body: ArrayBuffer;
  headers: Headers;
}

const MAX_ENTRIES = 64;
const results = new Map<string, Promise<Result>>();

const read = async (response: Response): Promise<Result> => ({
  status: response.status,
  body: await response.arrayBuffer(),
  headers: new Headers(response.headers),
});

export const GET: APIRoute = async (context) => {
  const key = new URL(context.request.url).search;
  let pending = results.get(key);

  if (!pending) {
    pending = Promise.resolve(transform(context)).then(read);
    results.set(key, pending);

    if (results.size > MAX_ENTRIES) results.delete(results.keys().next().value!);
  }

  let result: Result;

  try {
    result = await pending;
  } catch (error) {
    results.delete(key);
    throw error;
  }

  if (result.status !== 200) results.delete(key);

  return new Response(result.body, { status: result.status, headers: result.headers });
};
