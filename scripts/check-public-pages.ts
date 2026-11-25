/**
 * Production HTML regression checks. Run after build; all data lives in a disposable
 * EmDash site (emdash-sandbox.ts).
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { block, createSandbox, evening, root } from './emdash-sandbox'

const sandbox = await createSandbox('pages')

process.env.CANCEL_LINK_SECRET = 'pages-check-secret-of-at-least-32-characters'

const { cancelUrlFor } = await import('../src/lib/server/cancel-token')

/** The signed cancel link: GET shows, POST cancels once, anything else is refused privately. */
async function checkCancelLink(origin: string): Promise<void> {
  const bogus = await fetch(`${origin}/anmeldung/absagen?token=forged.token`)
  const bogusHtml = await bogus.text()

  assert.equal(bogus.status, 404)
  assert.equal(bogus.headers.get('cache-control'), 'private, no-store')
  assert.match(bogusHtml, /noindex/)
  assert.match(bogusHtml, /Dieser Link gilt nicht mehr/)

  const link = new URL(await cancelUrlFor('cancel-me', '2099-01-01'))
  const page = await fetch(`${origin}${link.pathname}${link.search}`)

  assert.equal(page.status, 200)
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer')
  assert.match(await page.text(), /Anmeldung absagen\?/)

  const post = () =>
    fetch(`${origin}/anmeldung/absagen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': origin, 'Sec-Fetch-Site': 'same-origin' },
      body: new URLSearchParams({ token: link.searchParams.get('token')! }),
    }).then(r => r.text())

  assert.match(await post(), /Du hast abgesagt/)
  assert.match(await post(), /Schon abgesagt/)
}

async function withServer(check: (origin: string) => Promise<void>): Promise<void> {
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = reservation.port!

  await reservation.stop(true)

  const child = Bun.spawn([process.execPath, '--no-env-file', join(root, 'server.ts')], {
    cwd: sandbox.dir,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      CANCEL_LINK_SECRET: process.env.CANCEL_LINK_SECRET,
    },
    stdout: 'ignore',
    stderr: 'pipe',
  })

  const errors = new Response(child.stderr).text()
  const origin = `http://127.0.0.1:${port}`

  try {
    let ready = false

    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        await fetch(`${origin}/favicon.svg`)
          .then(r => r.ok)
          .catch(() => false)
      ) {
        ready = true
        break
      }

      if (child.exitCode !== null) throw new Error(await errors)

      await Bun.sleep(50)
    }

    assert(ready, 'Production server did not start')
    await check(origin)
  }
  finally {
    child.kill()
    await child.exited
    await errors
  }
}

async function readPage(origin: string, path: string, status = 200): Promise<string> {
  const response = await fetch(`${origin}${path}`)
  const html = await response.text()

  assert.equal(response.status, status, `${path}: expected ${status}`)

  if (status === 503) assert.equal(response.headers.has('X-Astro-Cache'), false)

  assert.match(response.headers.get('cache-control') ?? '', status === 503 ? /no-store/ : /must-revalidate/)
  assert(!html.includes('<astro-island'), `${path}: public content must not hydrate`)
  assert(!html.includes('as="fetch"'), `${path}: no client data preload`)
  assert(!html.includes('PRIVATE'), `${path}: unpublished data must stay private`)
  assert.match(html, /rel="stylesheet"/, 'Shared CSS should be cacheable')
  assert.match(html, /<script type="speculationrules">/, `${path}: prefetch through speculation rules`)
  assert(!/<script[^>]+src="[^"]*\/page\.[^"]+\.js"/.test(html), `${path}: no prefetch script`)

  return html
}

/** Headers every response carries; EmDash's admin brings its own complete policy. */
function checkHeaders(path: string, headers: Headers): string {
  const csp = headers.get('content-security-policy') ?? ''

  assert.equal(headers.get('x-content-type-options'), 'nosniff', path)
  assert.match(headers.get('referrer-policy') ?? '', /strict-origin-when-cross-origin|no-referrer/, path)
  assert.match(headers.get('permissions-policy') ?? '', /camera=\(\)/, path)
  assert.match(csp, /frame-ancestors 'none'/, path)

  if (path.startsWith('/_emdash')) assert.match(csp, /default-src 'self'/, `${path}: a complete admin policy`)

  return csp
}

/**
 * The page CSP: a <meta> on prerendered pages, a header on rendered ones, whose
 * script-src holds the hash of every inline script and never 'unsafe-inline'.
 */
async function checkSecurity(origin: string, path: string): Promise<void> {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
  const html = await response.text()
  const csp = checkHeaders(path, response.headers)

  // EmDash's admin is its own app under its own policy.
  if (!html.includes('<html') || path.startsWith('/_emdash')) return

  const meta = /<meta http-equiv="content-security-policy" content="([^"]*)"/.exec(html)?.[1]
  const policy = meta ?? csp.split(/,\s*(?=default-src)/).find(p => /script-src/.test(p) && /sha256/.test(p))

  assert(policy, `${path}: page CSP`)
  assert.match(policy, /default-src 'self'/)
  assert(!/script-src[^;]*'unsafe-inline'/.test(policy), `${path}: no inline scripts allowed wholesale`)

  for (const script of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/ld\+json/.test(script[1])) continue

    const hash = `'sha256-${createHash('sha256').update(script[2]).digest('base64')}'`

    assert(policy.includes(hash), `${path}: inline script ${script[2].slice(0, 40)} lacks its hash`)
  }
}

/** The registration is a server-rendered form that also works without JavaScript. */
async function checkRegistration(origin: string, eventId: string): Promise<void> {
  const page = await readPage(origin, '/event/testabend')

  assert.match(page, /<form id="register" method="post" action="\?_action=register"/)
  assert.match(page, /Du bekommst eine Bestätigung mit einem Link zum Absagen\./)

  const post = (body: Record<string, string>) =>
    fetch(`${origin}/event/testabend?_action=register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': origin, 'Sec-Fetch-Site': 'same-origin' },
      body: new URLSearchParams(body),
    })

  const invalid = await post({ event_id: eventId, first_name: 'Ohne', last_name: '', email: 'kaputt' })
  const invalidHtml = await invalid.text()

  assert.equal(invalid.status, 400)
  assert.equal(invalid.headers.get('cache-control'), 'private, no-store', 'an answer to a POST is never cached')
  assert.match(invalidHtml, /Bitte gib deinen Nachnamen an\./)
  assert.match(invalidHtml, /value="Ohne"/, 'what was typed stays')

  const valid = await post({
    event_id: eventId,
    first_name: 'Ohne',
    last_name: 'Skript',
    email: 'noscript@example.invalid',
    privacy: 'on',
  })

  assert.equal(valid.status, 200)
  assert.match(await valid.text(), /Vielen Dank für deine Anmeldung/)
}

/** The portrait and the stylesheet are hashed build files; nothing is transformed on request. */
async function checkAssets(origin: string, home: string): Promise<void> {
  const image = /<img[^>]+src="([^"]+)"/.exec(home)?.[1] ?? ''

  assert(image.startsWith('/assets/'), 'Home portrait must be a build asset, not /_image')
  const portrait = await fetch(new URL(image, origin))

  assert.equal(portrait.status, 200)
  assert.match(portrait.headers.get('cache-control') ?? '', /immutable/)
  await portrait.arrayBuffer()
  assert(!home.includes('/_image'), 'SSR pages must not use the on-demand image endpoint')
  assert.equal((await fetch(`${origin}/_image?href=${encodeURIComponent(image)}&w=300&f=webp`)).status, 404)

  const css
    = /rel="stylesheet"[^>]*href="([^"]+)"/.exec(home)?.[1] ?? /href="([^"]+)"[^>]*rel="stylesheet"/.exec(home)?.[1]

  assert(css, 'Shared CSS must be present')
  const asset = await fetch(new URL(css, origin))

  assert.match(asset.headers.get('cache-control') ?? '', /max-age=31536000.*immutable/)
  await asset.arrayBuffer()
  const etag = asset.headers.get('etag')

  assert(etag, 'Node static server should provide ETags')
  assert.equal((await fetch(new URL(css, origin), { headers: { 'If-None-Match': etag } })).status, 304)
}

try {
  // The collections without entries: an empty schedule.
  await sandbox.seed()
  await withServer(async (origin) => {
    for (const path of ['/', '/event']) {
      const html = await readPage(origin, path)

      assert.match(html, /Der nächste Abend ist in Planung/)
      assert.match(html, /Über neue Termine informieren/)
    }
  })

  await sandbox.seed({
    events: [
      {
        id: 'open',
        slug: 'testabend',
        data: {
          title: 'Männerkreis',
          ...evening('2099-01-01'),
          city: 'Straubing',
          max_participants: 8,
          description: block('Ein Abend.'),
        },
      },
      { id: 'full', slug: 'voll', data: { title: 'Männerkreis', ...evening('2099-02-01'), max_participants: 1 } },
      {
        id: 'draft',
        slug: 'private',
        status: 'draft',
        data: { title: 'PRIVATE EVENT', ...evening('2099-03-01'), max_participants: 8 },
      },
    ],
    registrations: [
      {
        id: 'cancel-me',
        data: { first_name: 'Gast', last_name: 'Test', email: 'guest@example.invalid', event: '$ref:open' },
      },
      {
        id: 'seated',
        data: { first_name: 'Sitz', last_name: 'Test', email: 'seat@example.invalid', event: '$ref:full' },
      },
    ],
    testimonials: [
      { id: 'approved', data: { quote: 'Eine freigegebene Erfahrung.', name: 'Testteilnehmer' } },
      { id: 'long', data: { quote: 'Eine längere Erfahrung. '.repeat(25) } },
      { id: 'hidden', status: 'draft', data: { quote: 'PRIVATE QUOTE' } },
    ],
  })

  const openId = sandbox.eventId('testabend')

  await withServer(async (origin) => {
    const first = await fetch(origin)

    assert.equal(first.headers.get('X-Astro-Cache'), 'MISS')
    await first.text()
    const cached = await fetch(origin)

    assert.equal(cached.headers.get('X-Astro-Cache'), 'HIT')
    await cached.text()
    const personalized = await fetch(origin, { headers: { Cookie: 'test=1' } })

    assert.equal(personalized.headers.get('X-Astro-Cache'), 'HIT')
    await personalized.text()
    const queried = await fetch(`${origin}/?nocache=${Date.now()}`)

    assert.equal(queried.headers.get('X-Astro-Cache'), 'HIT', 'A query string must not bypass or fragment the cache')
    await queried.text()
    const hot = await fetch(origin)

    assert.equal(
      hot.headers.get('content-length'),
      String((await hot.arrayBuffer()).byteLength),
      'A repeated hit is served as bytes, not as a stream (server.ts)',
    )
    const home = await readPage(origin, '/')
    const overview = await readPage(origin, '/event')

    assert.match(home, /1\. Januar 2099/)
    assert.match(home, /Eine freigegebene Erfahrung/)
    // Every voice is read in full; nothing folds behind a click.
    assert.match(home, /(Eine längere Erfahrung\. ){25}/)
    assert.doesNotMatch(home, /<details class="group\/quote"/)
    assert.match(overview, /data-state="full"/)
    assert.match(overview, /Ausgebucht/)
    assert.match(overview, /href="\/event\/testabend"/)

    await checkAssets(origin, home)

    for (const path of ['/', '/event', '/event/testabend', '/impressum', '/_emdash/admin/setup', '/favicon.svg']) {
      await checkSecurity(origin, path)
    }

    await checkCancelLink(origin)
    await checkRegistration(origin, openId)

    // The calendar file iOS opens: a real URL, text/calendar, inline, linked from the page.
    const eventHtml = await fetch(`${origin}/event/testabend`).then(r => r.text())

    assert.match(eventHtml, /href="\/api\/public\/events\/testabend\/ics"/)
    assert(!eventHtml.includes('data:text/calendar'), 'no data: link, iOS Safari cannot open it')
    const ics = await fetch(`${origin}/api/public/events/testabend/ics`)

    assert.equal(ics.status, 200)
    assert.equal(ics.headers.get('content-type'), 'text/calendar; charset=utf-8')
    assert.match(ics.headers.get('content-disposition') ?? '', /^inline; filename="maennerkreis-testabend\.ics"$/)
    assert.match(await ics.text(), /BEGIN:VEVENT[\s\S]*URL;VALUE=URI:https?:\/\/[^\r]+\/event\/testabend/)

    const json = await fetch(`${origin}/api/public/events/testabend`)

    assert.equal(json.status, 200)
    assert.equal(json.headers.get('X-Astro-Cache'), 'MISS')
    assert.equal((await json.json()).availableSpots, 7, 'the seat taken without JavaScript')
    assert.equal((await fetch(`${origin}/api/public/events/testabend`)).headers.get('X-Astro-Cache'), 'HIT')
    const missing = await fetch(`${origin}/api/public/events/private`)

    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('cache-control'), 'no-store')
    assert.equal((await fetch(`${origin}/api/public/events`)).status, 404)

    for (const font of [
      'cormorant-500.woff2',
      'geist.woff2',
      'ibm-plex-sans.woff2',
      'vollkorn-500.woff2',
      'fraunces-500.woff2',
      'figtree.woff2',
      'dm-sans.woff2',
      'playfair-display-400.woff2',
    ]) {
      const response = await fetch(`${origin}/fonts/mail/${font}`, { headers: { Origin: 'https://listmonk.example' } })

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
      assert.equal(response.headers.get('Content-Type'), 'font/woff2')
      assert((await response.arrayBuffer()).byteLength > 1000)
    }

    assert.equal((await fetch(`${origin}/fonts/mail/not-a-font.woff2`)).status, 404)
    assert.equal((await fetch(`${origin}/health`, { method: 'HEAD' })).status, 200)
    // The old back office points at EmDash's admin, which wants a sign-in (or its setup).
    const admin = await fetch(`${origin}/admin`, { redirect: 'manual' })

    assert.equal(new URL(admin.headers.get('location') ?? '', origin).pathname, '/_emdash/admin')
    const cms = await fetch(`${origin}/_emdash/admin`, { redirect: 'manual' })

    assert.equal(cms.status, 302)
    assert.match(cms.headers.get('location') ?? '', /\/_emdash\/admin\/(setup|login)/)
    const registrationsApi = await fetch(`${origin}/_emdash/api/content/registrations`)

    assert.equal(registrationsApi.status, 401, 'registrations never leave the CMS without a sign-in')

    const retired = await fetch(`${origin}/atemuebung`, { redirect: 'manual' })

    assert.equal(retired.status, 301)
    assert.equal(new URL(retired.headers.get('location') ?? '', origin).pathname, '/')
    const crossSite = await fetch(`${origin}/_actions/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://evil.example',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: '',
    })

    assert.equal(crossSite.status, 403)
    const sameSite = await fetch(`${origin}/_actions/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': origin, 'Sec-Fetch-Site': 'same-origin' },
      body: '',
    })

    assert.equal(sameSite.status, 400, 'Same-site Action POST must reach input validation')
    const redirect = await fetch(`${origin}/events`, { redirect: 'manual' })

    assert([301, 302, 308].includes(redirect.status))
    assert.match(redirect.headers.get('location') ?? '', /\/event$/)

    const sitemap = await fetch(`${origin}/sitemap-0.xml`).then(r => r.text())

    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname)

    assert(paths.includes('/'))
    assert(paths.includes('/event'))

    for (const path of ['/impressum', '/datenschutz', '/teile-deine-erfahrung']) {
      assert(paths.includes(path), `${path} is public and belongs in the sitemap`)
    }

    assert(!paths.some(path => path.startsWith('/_emdash')))

    const events = await fetch(`${origin}/sitemap-events.xml`).then(r => r.text())

    assert.match(events, /\/event\/testabend</)
    assert.doesNotMatch(events, /\/event\/private</)

    console.info(
      `Public HTML: home ${Buffer.byteLength(home)} bytes, overview ${Buffer.byteLength(overview)} bytes; zero hydrated islands.`,
    )
  })

  // A malformed disposable database exercises unavailable-data states on a fresh server/cache.
  sandbox.breakTable('ec_testimonials')

  await withServer(async (origin) => {
    const response = await fetch(origin)
    const html = await response.text()

    assert.equal(response.status, 200, 'A failed quote read must not hide available events')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(html, /1\. Januar 2099/)
    assert.match(html, /Die Erfahrungen lassen sich gerade nicht laden/)
  })

  sandbox.breakTable('ec_events')

  await withServer(async (origin) => {
    for (const path of ['/', '/event']) {
      const html = await readPage(origin, path, 503)

      assert.match(html, /Die Termine sind gerade nicht abrufbar/)
      assert.match(html, /Seite erneut laden/)
      assert(!html.includes('Der nächste Abend ist in Planung'))
    }
  })

  // A database the server cannot read fails the health probe instead of reporting ok.
  await withServer(async (origin) => {
    for (const method of ['GET', 'HEAD']) {
      const health = await fetch(`${origin}/health`, { method })

      assert.equal(health.status, 503, `${method} /health without a database`)
      assert.equal(health.headers.get('cache-control'), 'no-store')
    }
  })

  console.info(
    'Public page checks passed: empty, scheduled, full, private, unavailable, images, sitemap, security and health.',
  )
}
finally {
  await sandbox.remove()
}
