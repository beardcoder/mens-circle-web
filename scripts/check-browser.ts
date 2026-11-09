/**
 * Browser checks against the built server (run after `bun run build`): every page
 * loads in Chromium without console errors (CSP included), axe finds nothing serious
 * or critical in light and dark, and the interactive pieces work: phone menu, mode
 * toggle, calendar popover, registration with and without JavaScript, newsletter,
 * testimonial and the admin guard. listmonk is a local fake; the database is
 * disposable. Screenshots land in `dist/browser-shots/` (a CI artifact).
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Browser, type BrowserContext, chromium, devices, type Page } from 'playwright';

const sandbox = await mkdtemp(join(tmpdir(), 'mens-circle-browser-'));
const shots = new URL('../dist/browser-shots/', import.meta.url).pathname;

process.env.DATABASE_PATH = join(sandbox, 'browser.sqlite');
process.env.ADMIN_SESSION_SECRET = 'browser-check-secret-of-at-least-32-characters';
process.env.ADMIN_EMAIL = 'admin@example.invalid';

const { db } = await import('../src/lib/server/db');
const { events, testimonials } = await import('../src/lib/server/db/schema');
const { createSession, SESSION_COOKIE } = await import('../src/lib/server/auth');
const axeSource = await readFile(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

await db.insert(events).values([
  {
    id: 'open',
    title: 'Männerkreis',
    slug: 'testabend',
    eventDate: '2099-01-01',
    startTime: '19:00',
    endTime: '21:30',
    location: 'Gemeindehaus',
    street: 'Teststraße 1',
    postalCode: '94315',
    city: 'Straubing',
    isPublished: true,
  },
  { id: 'full', title: 'Männerkreis', slug: 'voll', eventDate: '2099-02-01', maxParticipants: 1, isPublished: true },
  { id: 'past', title: 'Männerkreis', slug: 'vorbei', eventDate: '2020-02-01', isPublished: true },
]);
await db
  .insert(testimonials)
  .values([{ quote: 'Ein ruhiger, ehrlicher Abend.', authorName: 'Tom', isPublished: true }]);

/** listmonk, faked: every call succeeds. */
const listmonk = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch: (request) =>
    Response.json(new URL(request.url).pathname === '/api/subscribers' ? { data: { id: 1 } } : { data: true }),
});

const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
const port = reservation.port!;

await reservation.stop(true);

const server = Bun.spawn([process.execPath, '--no-env-file', 'server.ts'], {
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    DATABASE_PATH: process.env.DATABASE_PATH,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    LISTMONK_URL: `http://127.0.0.1:${listmonk.port}`,
    LISTMONK_API_USER: 'test',
    LISTMONK_API_TOKEN: 'test',
    LISTMONK_LIST_IDS: '1',
    LISTMONK_TX_REGISTRATION_CONFIRMATION: '1',
  },
  stdout: 'ignore',
  stderr: 'pipe',
});

const origin = `http://127.0.0.1:${port}`;

const problems: string[] = [];

/** Console errors and page errors, CSP violations among them. */
const watch = (page: Page, label: string): void => {
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 4\d\d/.test(message.text())) {
      problems.push(`${label}: ${message.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`${label}: ${error.message}`));
};

/** axe on the current state of the page; serious and critical findings fail. */
async function axe(page: Page, label: string): Promise<void> {
  // Evaluated, not injected as a <script>: the page's CSP would (rightly) refuse it.
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const result = await window.axe.run(document, { resultTypes: ['violations'] });

    return (result.violations as { id: string; impact: string; nodes: { target: string[] }[] }[])
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });

  for (const violation of violations) problems.push(`${label}: axe ${violation}`);
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
  '/styleguide',
  '/gibt-es-nicht',
  '/admin/login',
];

async function pages(browser: Browser): Promise<void> {
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();

    watch(page, scheme);

    for (const path of PAGES) {
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
      await axe(page, `${scheme} ${path}`);
      await page.screenshot({
        path: join(shots, `${scheme}${path.replaceAll('/', '_') || '_home'}.png`),
        fullPage: true,
      });
    }

    await context.close();
  }
}

async function interactions(browser: Browser): Promise<void> {
  const phone: BrowserContext = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  const page = await phone.newPage();

  watch(page, 'phone');

  // Phone menu: a modal dialog that Escape closes.
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.click('[data-nav-open]');
  assert(await page.evaluate(() => document.querySelector('dialog')?.open), 'the phone menu opens');
  await axe(page, 'phone menu');
  await page.keyboard.press('Escape');
  assert(!(await page.evaluate(() => document.querySelector('dialog')?.open)), 'Escape closes the menu');

  // Mode toggle in the footer pins the choice.
  await page.locator('footer [data-mode-option="dark"]').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), 'dark');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.modeResolved), 'dark', 'the pin survives');

  // Calendar popover on an event page.
  await page.goto(`${origin}/event/testabend`, { waitUntil: 'networkidle' });
  await page.locator('[popovertarget="calendar-modal"]').first().click();
  assert(await page.locator('#calendar-modal').isVisible(), 'the calendar popover opens');
  await axe(page, 'calendar popover');
  await page.keyboard.press('Escape');

  // Registration with JavaScript: answered in place.
  await page.fill('#register-first_name', 'Erik');
  await page.fill('#register-last_name', 'Browser');
  await page.fill('#register-email', 'erik@example.invalid');
  await page.check('#register input[name="privacy"]');
  await page.click('#register button[type="submit"]');
  await page.waitForSelector('#register-status[data-tone="success"]');

  // Newsletter and testimonial.
  await page.goto(`${origin}/event`, { waitUntil: 'networkidle' });
  const newsletter = page.locator('form[data-form="newsletter"]').first();

  await newsletter.locator('input[name="email"]').fill('news@example.invalid');
  await newsletter.locator('button[type="submit"]').click();
  await page.waitForSelector('[data-form-status][data-tone="success"]');
  await page.goto(`${origin}/teile-deine-erfahrung`, { waitUntil: 'networkidle' });
  await page.fill('#quote', 'Ein Abend, an dem ich einfach zuhören durfte.');
  await page.fill('#testimonial_email', 'voice@example.invalid');
  await page.check('#testimonial input[name="privacy"]');
  await page.click('#testimonial button[type="submit"]');
  await page.waitForSelector('#testimonial-status[data-tone="success"]');
  await phone.close();

  // Registration without JavaScript: the page answers the POST.
  const noScript = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const plain = await noScript.newPage();

  await plain.goto(`${origin}/event/testabend`);
  await plain.fill('#register-first_name', 'Ohne');
  await plain.fill('#register-last_name', 'Skript');
  await plain.fill('#register-email', 'plain@example.invalid');
  await plain.check('#register input[name="privacy"]');
  await Promise.all([plain.waitForLoadState('load'), plain.click('#register button[type="submit"]')]);
  assert.match(await plain.content(), /Vielen Dank für deine Anmeldung/);
  await noScript.close();

  // The admin: a guard without a session, an accessible workspace with one.
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();

  watch(adminPage, 'admin');
  await adminPage.goto(`${origin}/admin`);
  assert.match(adminPage.url(), /\/admin\/login/);
  await admin.addCookies([{ name: SESSION_COOKIE, value: await createSession('admin@example.invalid'), url: origin }]);

  for (const path of ['/admin', '/admin/events', '/admin/events/open', '/admin/events/open/registrations']) {
    await adminPage.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    await axe(adminPage, `admin ${path}`);
  }

  await admin.close();
}

try {
  await mkdir(shots, { recursive: true });

  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      await fetch(`${origin}/health`).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;

    await Bun.sleep(50);
  }

  const browser = await chromium.launch();

  try {
    await pages(browser);
    await interactions(browser);
  } finally {
    await browser.close();
  }

  assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
  console.info(`Browser checks passed: ${PAGES.length} pages in light and dark, axe clean, interactions work.`);
} finally {
  server.kill();
  await server.exited;
  await listmonk.stop(true);
  db.$client.close();
  await rm(sandbox, { recursive: true, force: true });
}
