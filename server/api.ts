/**
 * EmDash — API route handlers.
 *
 * Replaces the PocketBase custom routes (pb_hooks/routes_public.pb.js) with
 * native Bun request handlers. All routes return JSON with the standard
 * { success, message } contract. Database access is via bun:sqlite.
 */
import { getDb, generateId, nowISO } from './db.ts';
import {
  config,
  escapeHtml,
  randomToken,
  isEventPast,
  buildIcs,
  sendMail,
  renderRegistrationConfirmation,
  renderWaitlistConfirmation,
  renderAdminNotification,
  renderWaitlistPromotion,
  renderNewsletterWelcome,
  type EventRow,
  type ParticipantRow,
} from './lib.ts';

interface ApiResponse {
  success: boolean;
  message: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function countActiveRegistrations(eventId: string): number {
  const db = getDb();
  const row = db
    .query(
      `SELECT COUNT(*) as cnt FROM registrations
       WHERE event_id = ? AND deleted_at IS NULL
       AND (status = 'registered' OR status = 'attended')`,
    )
    .get(eventId) as { cnt: number } | null;
  return row?.cnt ?? 0;
}

function upsertParticipant(
  email: string,
  fields: { first_name?: string; last_name?: string; phone?: string },
): ParticipantRow {
  const db = getDb();
  let participant = db
    .query('SELECT * FROM participants WHERE email = ?')
    .get(email) as ParticipantRow | null;

  const now = nowISO();
  if (!participant) {
    const id = generateId();
    db.query(
      `INSERT INTO participants (id, email, first_name, last_name, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      email,
      fields.first_name || '',
      fields.last_name || '',
      fields.phone || '',
      now,
      now,
    );
    participant = db
      .query('SELECT * FROM participants WHERE id = ?')
      .get(id) as ParticipantRow;
  } else {
    // Update name/phone if provided
    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    if (fields.first_name) {
      updates.push('first_name = ?');
      params.push(fields.first_name);
    }
    if (fields.last_name) {
      updates.push('last_name = ?');
      params.push(fields.last_name);
    }
    if (fields.phone) {
      updates.push('phone = ?');
      params.push(fields.phone);
    }
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(participant.id);
      db.query(
        `UPDATE participants SET ${updates.join(', ')} WHERE id = ?`,
      ).run(...params);
      participant = db
        .query('SELECT * FROM participants WHERE id = ?')
        .get(participant.id) as ParticipantRow;
    }
  }
  return participant;
}

function eventDto(ev: EventRow) {
  const activeCount = countActiveRegistrations(ev.id);
  const available = Math.max(0, ev.max_participants - activeCount);
  return {
    id: ev.id,
    title: ev.title,
    slug: ev.slug,
    description: ev.description,
    event_date: ev.event_date,
    start_time: ev.start_time,
    end_time: ev.end_time,
    location: ev.location,
    location_details: ev.location_details,
    street: ev.street,
    postal_code: ev.postal_code,
    city: ev.city,
    latitude: ev.latitude,
    longitude: ev.longitude,
    max_participants: ev.max_participants,
    cost_basis: ev.cost_basis,
    image_url: ev.image_url,
    available_spots: available,
    is_full: available <= 0,
    is_past: isEventPast(ev),
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleEventRegister(req: Request): Promise<Response> {
  try {
    const data = (await req.json()) as Record<string, unknown>;
    const eventId = String(data.event_id || '');
    const firstName = String(data.first_name || '').trim();
    const lastName = String(data.last_name || '').trim();
    const email = String(data.email || '')
      .trim()
      .toLowerCase();
    const phone = String(data.phone_number || '').trim();
    const privacy = data.privacy;

    // Honeypot
    if (typeof data.website === 'string' && data.website.trim() !== '') {
      return json(200, {
        success: true,
        message: `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`,
      });
    }

    if (
      privacy !== true &&
      privacy !== 'true' &&
      privacy !== 1 &&
      privacy !== '1'
    ) {
      return json(422, {
        success: false,
        message: 'Bitte bestätige die Datenschutzerklärung.',
      });
    }
    if (!email || !email.includes('@')) {
      return json(422, {
        success: false,
        message: 'Bitte gib eine gültige E-Mail-Adresse an.',
      });
    }
    if (!eventId) {
      return json(422, {
        success: false,
        message: 'Es wurde keine Veranstaltung angegeben.',
      });
    }

    const db = getDb();
    const event = db
      .query(
        'SELECT * FROM events WHERE id = ? AND is_published = 1 AND deleted_at IS NULL',
      )
      .get(eventId) as EventRow | null;

    if (!event) {
      return json(404, {
        success: false,
        message: 'Diese Veranstaltung ist nicht verfügbar.',
      });
    }
    if (isEventPast(event)) {
      return json(410, {
        success: false,
        message:
          'Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich.',
      });
    }

    // Capacity / waitlist
    const activeCount = countActiveRegistrations(event.id);
    const isWaitlist = activeCount >= event.max_participants;
    const status = isWaitlist ? 'waitlist' : 'registered';

    // Upsert participant
    const participant = upsertParticipant(email, {
      first_name: firstName,
      last_name: lastName,
      phone,
    });

    // Check existing registration
    const existing = db
      .query(
        'SELECT * FROM registrations WHERE participant_id = ? AND event_id = ?',
      )
      .get(participant.id, event.id) as {
      id: string;
      status: string;
      deleted_at: string | null;
    } | null;

    if (existing && !existing.deleted_at) {
      const msg =
        existing.status === 'waitlist'
          ? 'Du bist bereits auf der Warteliste für diese Veranstaltung.'
          : 'Du bist bereits für diese Veranstaltung angemeldet.';
      return json(409, { success: false, message: msg });
    }

    const now = nowISO();
    if (existing) {
      // Restore soft-deleted registration
      db.query(
        `UPDATE registrations SET status = ?, registered_at = ?, cancelled_at = NULL, deleted_at = NULL, updated_at = ? WHERE id = ?`,
      ).run(status, now, now, existing.id);
    } else {
      // Create new registration
      db.query(
        `INSERT INTO registrations (id, participant_id, event_id, status, registered_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(generateId(), participant.id, event.id, status, now, now, now);
    }

    // Send emails (fire-and-forget)
    if (status === 'waitlist') {
      const tpl = renderWaitlistConfirmation(event, participant);
      void sendMail({ to: participant.email, ...tpl });
    } else {
      const tpl = renderRegistrationConfirmation(event, participant);
      void sendMail({ to: participant.email, ...tpl });
    }
    const newActiveCount = countActiveRegistrations(event.id);
    const adminTpl = renderAdminNotification(
      event,
      participant,
      newActiveCount,
    );
    void sendMail({ to: config.MAIL_ADMIN_ADDRESS, ...adminTpl });

    const message = isWaitlist
      ? `Du wurdest auf die Warteliste eingetragen, ${firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird.`
      : `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`;

    return json(200, { success: true, message });
  } catch (err) {
    console.error('/api/event/register failed:', err);
    return json(500, {
      success: false,
      message:
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    });
  }
}

async function handleNewsletterSubscribe(req: Request): Promise<Response> {
  try {
    const data = (await req.json()) as Record<string, unknown>;
    const email = String(data.email || '')
      .trim()
      .toLowerCase();

    // Honeypot
    if (typeof data.website === 'string' && data.website.trim() !== '') {
      return json(200, {
        success: true,
        message:
          'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.',
      });
    }

    if (!email || !email.includes('@')) {
      return json(422, {
        success: false,
        message: 'Bitte gib eine gültige E-Mail-Adresse an.',
      });
    }

    const db = getDb();
    const participant = upsertParticipant(email, {});

    // Check existing subscription
    const existing = db
      .query('SELECT * FROM newsletter_subscribers WHERE participant_id = ?')
      .get(participant.id) as {
      id: string;
      token: string;
      deleted_at: string | null;
      unsubscribed_at: string | null;
    } | null;

    const now = nowISO();

    if (existing && !existing.deleted_at && !existing.unsubscribed_at) {
      return json(409, {
        success: false,
        message:
          'Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.',
      });
    }

    const token = randomToken(64);

    if (existing) {
      // Reactivate
      db.query(
        `UPDATE newsletter_subscribers SET token = ?, subscribed_at = ?, confirmed_at = ?, unsubscribed_at = NULL, deleted_at = NULL, updated_at = ? WHERE id = ?`,
      ).run(token, now, now, now, existing.id);
    } else {
      db.query(
        `INSERT INTO newsletter_subscribers (id, participant_id, token, subscribed_at, confirmed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(generateId(), participant.id, token, now, now, now, now);
    }

    // Send welcome email
    const tpl = renderNewsletterWelcome(participant, token);
    void sendMail({ to: participant.email, ...tpl });

    return json(200, {
      success: true,
      message:
        'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.',
    });
  } catch (err) {
    console.error('/api/newsletter/subscribe failed:', err);
    return json(500, {
      success: false,
      message:
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    });
  }
}

async function handleTestimonialSubmit(req: Request): Promise<Response> {
  try {
    const data = (await req.json()) as Record<string, unknown>;
    const quote = String(data.quote || '').trim();
    const authorName = String(data.author_name || '').trim();
    const role = String(data.role || '').trim();
    const email = String(data.email || '')
      .trim()
      .toLowerCase();
    const privacy = data.privacy;

    // Honeypot
    if (typeof data.website === 'string' && data.website.trim() !== '') {
      return json(200, {
        success: true,
        message:
          'Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.',
      });
    }

    if (
      privacy !== true &&
      privacy !== 'true' &&
      privacy !== 1 &&
      privacy !== '1'
    ) {
      return json(422, {
        success: false,
        message: 'Bitte bestätige die Datenschutzerklärung.',
      });
    }
    if (quote.length < 10 || quote.length > 1000) {
      return json(422, {
        success: false,
        message:
          'Dein Testimonial muss zwischen 10 und 1000 Zeichen lang sein.',
      });
    }
    if (email && !email.includes('@')) {
      return json(422, {
        success: false,
        message: 'Bitte gib eine gültige E-Mail-Adresse an.',
      });
    }

    const db = getDb();
    const now = nowISO();
    db.query(
      `INSERT INTO testimonials (id, quote, author_name, email, role, is_published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    ).run(generateId(), quote, authorName, email, role, now, now);

    return json(200, {
      success: true,
      message:
        'Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.',
    });
  } catch (err) {
    console.error('/api/testimonial/submit failed:', err);
    return json(500, {
      success: false,
      message:
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    });
  }
}

function handleNextEvent(): Response {
  try {
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    )
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');

    const ev = db
      .query(
        `SELECT * FROM events
         WHERE is_published = 1 AND deleted_at IS NULL AND event_date >= ?
         ORDER BY event_date ASC LIMIT 1`,
      )
      .get(startOfToday) as EventRow | null;

    if (!ev) return json(200, { event: null });
    return json(200, { event: eventDto(ev) });
  } catch (err) {
    console.error('/api/public/events/next failed:', err);
    return json(200, { event: null });
  }
}

function handleAllEvents(): Response {
  try {
    const db = getDb();
    const rows = db
      .query(
        `SELECT * FROM events WHERE is_published = 1 AND deleted_at IS NULL ORDER BY event_date ASC`,
      )
      .all() as EventRow[];

    return json(200, { events: rows.map(eventDto) });
  } catch (err) {
    console.error('/api/public/events failed:', err);
    return json(200, { events: [] });
  }
}

function handleEventBySlug(slug: string): Response {
  try {
    const db = getDb();
    const ev = db
      .query(
        'SELECT * FROM events WHERE slug = ? AND is_published = 1 AND deleted_at IS NULL',
      )
      .get(slug) as EventRow | null;

    if (!ev) return json(404, { event: null });
    return json(200, { event: eventDto(ev) });
  } catch (err) {
    console.error('/api/public/events/{slug} failed:', err);
    return json(404, { event: null });
  }
}

function handleEventIcs(slug: string): Response {
  try {
    const db = getDb();
    const ev = db
      .query(
        'SELECT * FROM events WHERE slug = ? AND is_published = 1 AND deleted_at IS NULL',
      )
      .get(slug) as EventRow | null;

    if (!ev) return json(404, { event: null });

    const ics = buildIcs(ev);
    if (!ics) return json(404, { event: null });

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="termin-${slug}.ics"`,
      },
    });
  } catch (err) {
    console.error('/api/public/events/{slug}/ics failed:', err);
    return json(404, { event: null });
  }
}

function handleNewsletterUnsubscribe(token: string): Response {
  const pageStyle =
    "font-family:'DM Sans',Helvetica,Arial,sans-serif;background-color:#efe9dd;color:#2c2418;margin:0;padding:0;";
  const cardStyle =
    'max-width:560px;margin:64px auto;background:#ffffff;border-radius:8px;padding:48px 40px;text-align:center;';

  function page(title: string, message: string): string {
    return (
      `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>${escapeHtml(title)}</title></head>` +
      `<body style="${pageStyle}"><div style="${cardStyle}">` +
      `<h1 style="font-family:Georgia,serif;font-size:24px;color:#2c2418;margin:0 0 16px;">${escapeHtml(title)}</h1>` +
      `<p style="font-size:16px;line-height:1.7;color:#5c4a3a;margin:0;">${escapeHtml(message)}</p>` +
      `</div></body></html>`
    );
  }

  try {
    const db = getDb();
    const sub = db
      .query('SELECT * FROM newsletter_subscribers WHERE token = ?')
      .get(token) as { id: string } | null;

    if (!sub) {
      return new Response(
        page(
          'Link ungültig',
          'Dieser Abmelde-Link ist leider ungültig oder abgelaufen.',
        ),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      );
    }

    db.query(
      'UPDATE newsletter_subscribers SET unsubscribed_at = ? WHERE id = ?',
    ).run(nowISO(), sub.id);

    return new Response(
      page('Abgemeldet', 'Du wurdest erfolgreich vom Newsletter abgemeldet.'),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (err) {
    console.error('/newsletter/unsubscribe failed:', err);
    return new Response(
      page(
        'Fehler',
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
      ),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

function handleHealth(): Response {
  return json(200, { status: 'ok' });
}

// ── Public router ─────────────────────────────────────────────────────────────

export async function handleApiRequest(
  req: Request,
  url: URL,
): Promise<Response | null> {
  const { pathname } = url;
  const method = req.method;

  // Health check
  if (pathname === '/api/health' && method === 'GET') {
    return handleHealth();
  }

  // POST routes
  if (method === 'POST') {
    if (pathname === '/api/event/register') return handleEventRegister(req);
    if (pathname === '/api/newsletter/subscribe')
      return handleNewsletterSubscribe(req);
    if (pathname === '/api/testimonial/submit')
      return handleTestimonialSubmit(req);
  }

  // GET routes
  if (method === 'GET') {
    if (pathname === '/api/public/events/next') return handleNextEvent();
    if (pathname === '/api/public/events') return handleAllEvents();

    // /api/public/events/{slug}/ics
    const icsMatch = pathname.match(/^\/api\/public\/events\/([^/]+)\/ics$/);
    if (icsMatch) return handleEventIcs(decodeURIComponent(icsMatch[1]));

    // /api/public/events/{slug}
    const slugMatch = pathname.match(/^\/api\/public\/events\/([^/]+)$/);
    if (slugMatch) return handleEventBySlug(decodeURIComponent(slugMatch[1]));

    // Newsletter unsubscribe
    const unsubMatch = pathname.match(/^\/newsletter\/unsubscribe\/([^/]+)$/);
    if (unsubMatch)
      return handleNewsletterUnsubscribe(decodeURIComponent(unsubMatch[1]));
  }

  // Not an API route — return null to let the Astro handler take over.
  return null;
}
