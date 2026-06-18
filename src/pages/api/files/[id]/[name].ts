/**
 * GET /api/files/{id}/{name} — serve an uploaded event image from the data
 * volume. Replaces PocketBase's `/api/files/...` file serving. Path-traversal
 * guarded; long-cached (filenames are effectively immutable per upload).
 */
import path from 'node:path';
import type { APIRoute } from 'astro';
import { config } from '../../../../server/config';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  const name = params.name ?? '';
  // Reject anything that isn't a plain id/name segment.
  if (!/^[\w-]+$/.test(id) || !/^[\w.-]+$/.test(name) || name.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const root = path.resolve(config.UPLOAD_DIR);
  const file = path.resolve(root, id, name);
  if (file !== root && !file.startsWith(root + path.sep)) {
    return new Response('Not found', { status: 404 });
  }

  const blob = Bun.file(file);
  if (!(await blob.exists())) return new Response('Not found', { status: 404 });

  return new Response(blob, {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=604800' },
  });
};
