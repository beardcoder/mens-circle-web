/**
 * Browser checks against the built server (run after `bun run build`): every page
 * loads in Chromium without console errors (CSP included), axe finds nothing serious
 * or critical in light and dark, and the interactive pieces work: phone menu, mode
 * toggle, calendar popover, registration with and without JavaScript, newsletter,
 * testimonial and EmDash's admin setup. listmonk is a local fake; the site is a
 * disposable EmDash sandbox. Screenshots land in `dist/browser-shots/` (a CI artifact).
 */
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { type Browser, type BrowserContext, chromium, devices, type Page } from 'playwright'

import { block, createSandbox, evening, root } from './emdash-sandbox'

const sandbox = await createSandbox('browser')
const shots = new URL('../dist/browser-shots/', import.meta.url).pathname
const axeSource = await readFile(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')

await sandbox.seed({
  events: [
    {
      id: 'open',
      slug: 'testabend',
      data: {
        title: 'Männerkreis',
        ...evening('2099-01-01'),
        max_participants: 2,
        location: 'Gemeindehaus',
        street: 'Teststraße 1',
        postal_code: '94315',
        city: 'Straubing',
        description: block('Ein Abend im Kreis.'),
      },
    },
    { id: 'full', slug: 'voll', data: { title: 'Männerkreis', ...evening('2099-02-01'), max_participants: 1 } },
    { id: 'past', slug: 'vorbei', data: { title: 'Männerkreis', ...evening('2020-02-01'), max_participants: 8 } },
  ],
  registrations: [
    {
      id: 'seated',
      data: { first_name: 'Sitz', last_name: 'Test', email: 'seat@example.invalid', event: '$ref:full' },
    },
  ],
  testimonials: [{ id: 'tom', data: { quote: 'Ein ruhiger, ehrlicher Abend.', name: 'Tom' } }],
})

/** listmonk, faked: every call succeeds. */
const listmonk = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch: request =>
    Response.json(new URL(request.url).pathname === '/api/subscribers' ? { data: { id: 1 } } : { data: true }),
})

const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
const port = reservation.port!

await reservation.stop(true)

const server = Bun.spawn([process.execPath, '--no-env-file', join(root, 'server.ts')], {
  cwd: sandbox.dir,
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    CANCEL_LINK_SECRET: 'browser-check-secret-of-at-least-32-characters',
    LISTMONK_URL: `http://127.0.0.1:${listmonk.port}`,
    LISTMONK_API_USER: 'test',
    LISTMONK_API_TOKEN: 'test',
    LISTMONK_LIST_IDS: '1',
  },
  stdout: 'ignore',
  stderr: 'pipe',
})

const origin = `http://127.0.0.1:${port}`

const problems: string[] = []

/** Console errors and page errors, CSP violations among them. */
const watch = (page: Page, label: string): void => {
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 4\d\d/.test(message.text())) {
      problems.push(`${label}: ${message.text().slice(0, 300)}`)
    }
  })
  page.on('pageerror', error => problems.push(`${label}: ${error.message}`))
}

/** axe on the current state of the page; serious and critical findings fail. */
async function axe(page: Page, label: string): Promise<void> {
  // Evaluated, not injected as a <script>: the page's CSP would (rightly) refuse it.
  await page.evaluate(axeSource)
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const result = await window.axe.run(document, { resultTypes: ['violations'] })

    return (result.violations as { id: string, impact: string, nodes: { target: string[] }[] }[])
      .filter(v => v.impact === 'serious' || v.impact === 'critical')
      .map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
  })

  for (const violation of violations) problems.push(`${label}: axe ${violation}`)
}

const PAGES = [
  '/',
  '/event',
  '/event/testabend',
  '/event/voll',
  '/event/vorbei',
  '/teile-deine-erfahrung',
  '/warum-ich-den-maennerkreis-leite',
  '/impressum',
  '/datenschutz',
  '/gibt-es-nicht',
]

async function pages(browser: Browser): Promise<void> {
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme: scheme, reducedMotion: 'reduce' })
    const page = await context.newPage()

    watch(page, scheme)

    for (const path of PAGES) {
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' })
      await axe(page, `${scheme} ${path}`)
      await page.screenshot({
        path: join(shots, `${scheme}${path.replaceAll('/', '_') || '_home'}.png`),
        fullPage: true,
      })
    }

    await context.close()
  }
}

async function interactions(browser: Browser): Promise<void> {
  const phone: BrowserContext = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' })
  const page = await phone.newPage()

  watch(page, 'phone')

  // Phone menu: a modal dialog that Escape closes.
  await page.goto(origin, { waitUntil: 'networkidle' })
  await page.click('[data-nav-open]')
  assert(await page.evaluate(() => document.querySelector('dialog')?.open), 'the phone menu opens')
  await axe(page, 'phone menu')
  await page.keyboard.press('Escape')
  assert(!(await page.evaluate(() => document.querySelector('dialog')?.open)), 'Escape closes the menu')

  // Mode toggle in the footer pins the choice.
  await page.locator('footer [data-mode-option="dark"]').click()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), 'dark')
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.evaluate(() => document.documentElement.dataset.modeResolved), 'dark', 'the pin survives')

  // Calendar popover on an event page.
  await page.goto(`${origin}/event/testabend`, { waitUntil: 'networkidle' })
  await page.setViewportSize({ width: 320, height: 680 })
  const date = page.locator('#header time')
  assert(!(await date.isVisible()))
  await page.locator('#header a[href="#anmeldung"]:visible').click()
  await date.waitFor()
  assert.equal(await date.innerText(), '01.01.2099')
  assert(!(await page.locator('[data-event-dock]').isVisible()))
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: join(shots, 'mobile-registration.png') })
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await date.waitFor({ state: 'hidden' })
  await page.locator('[popovertarget="calendar-modal"]').first().click()
  assert(await page.locator('#calendar-modal').isVisible(), 'the calendar popover opens')
  await axe(page, 'calendar popover')
  await page.keyboard.press('Escape')

  // Registration with JavaScript: answered in place.
  assert.equal(await page.locator('#anmeldung [data-seat-text]').innerText(), 'Noch 2 Plätze frei')
  await page.fill('#register-first_name', 'Erik')
  await page.fill('#register-last_name', 'Browser')
  await page.fill('#register-email', 'erik@example.invalid')
  await page.check('#register input[name="privacy"]')
  await page.click('#register button[type="submit"]')
  await page.waitForSelector('#register-status[data-tone="success"]')

  assert.equal(await page.locator('#anmeldung [data-seat-text]').innerText(), 'Noch 1 Platz frei')

  // Newsletter and testimonial.
  await page.goto(`${origin}/event`, { waitUntil: 'networkidle' })
  const newsletter = page.locator('form[data-form="newsletter"]').first()

  await newsletter.locator('input[name="email"]').fill('news@example.invalid')
  await newsletter.locator('button[type="submit"]').click()
  await page.waitForSelector('[data-form-status][data-tone="success"]')
  await page.goto(`${origin}/teile-deine-erfahrung`, { waitUntil: 'networkidle' })
  await page.fill('#quote', 'Ein Abend, an dem ich einfach zuhören durfte.')
  await page.check('#testimonial input[name="privacy"]')
  await page.click('#testimonial button[type="submit"]')
  await page.waitForSelector('#testimonial-status[data-tone="success"]')
  await phone.close()

  // Registration without JavaScript: the page answers the POST.
  const noScript = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' })
  const plain = await noScript.newPage()

  await plain.goto(`${origin}/event/testabend`)
  await plain.fill('#register-first_name', 'Ohne')
  await plain.fill('#register-last_name', 'Skript')
  await plain.fill('#register-email', 'plain@example.invalid')
  await plain.check('#register input[name="privacy"]')
  await Promise.all([plain.waitForLoadState('load'), plain.click('#register button[type="submit"]')])
  assert.match(await plain.content(), /Vielen Dank für deine Anmeldung/)
  await plain.goto(`${origin}/event/testabend`)
  assert.equal(await plain.locator('#anmeldung [data-seat-text]').innerText(), 'Ausgebucht')
  await noScript.close()

  // The old back office leads to EmDash's admin, which renders under its own policy.
  const admin = await browser.newContext()
  const adminPage = await admin.newPage()

  watch(adminPage, 'admin')
  await adminPage.goto(`${origin}/admin`, { waitUntil: 'networkidle' })
  assert.match(adminPage.url(), /\/_emdash\/admin\/(setup|login)/)
  await adminPage.getByText('Set up your site').or(adminPage.getByRole('heading')).first().waitFor()
  await adminPage.screenshot({ path: join(shots, 'admin-setup.png'), fullPage: true })
  await admin.close()
}

try {
  await mkdir(shots, { recursive: true })

  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      await fetch(`${origin}/health`).then(
        r => r.ok,
        () => false,
      )
    )
      break

    await Bun.sleep(50)
  }

  const browser = await chromium.launch()

  try {
    await pages(browser)
    await interactions(browser)
  }
  finally {
    await browser.close()
  }

  assert.deepEqual(problems, [], `\n${problems.join('\n')}`)
  console.info(`Browser checks passed: ${PAGES.length} pages in light and dark, axe clean, interactions work.`)
}
finally {
  server.kill()
  await server.exited
  await listmonk.stop(true)
  await sandbox.remove()
}
