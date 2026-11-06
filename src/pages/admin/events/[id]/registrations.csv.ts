/**
 * `GET /admin/events/<id>/registrations.csv`: the attendance list for the evening
 * (name, phone, e-mail, status, note), behind the admin guard in src/middleware.ts.
 * Semicolons and a BOM, so spreadsheet apps in German locales open it as columns.
 */
import type { APIRoute } from 'astro';

import { readAdminRegistrations } from '@lib/server/admin-data';

export const prerender = false;

const LABELS = { registered: 'Angemeldet', waitlist: 'Warteliste', cancelled: 'Storniert', attended: 'Teilgenommen' };

/** One cell; a leading =, +, - or @ is defused so no spreadsheet runs it as a formula. */
const cell = (value: string): string => {
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;

  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.admin) return new Response(null, { status: 401 });

  const data = await readAdminRegistrations(params.id ?? '');

  if (!data) return new Response('Veranstaltung nicht gefunden.', { status: 404 });

  const rows = data.registrations
    .filter((row) => row.status !== 'cancelled')
    .sort((a, b) => a.status.localeCompare(b.status) || a.lastName.localeCompare(b.lastName, 'de'))
    .map((row) =>
      [`${row.firstName} ${row.lastName}`.trim(), row.phone, row.email, LABELS[row.status], row.note]
        .map(cell)
        .join(';'),
    );

  const csv = `\uFEFF${['Name;Telefon;E-Mail;Status;Notiz', ...rows].join('\r\n')}\r\n`;
  const name = `teilnehmer-${data.eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
