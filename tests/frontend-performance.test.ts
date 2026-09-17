import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// No app/server imports, live fetches or database access. Each worker/timer gets
// a fresh VM so these tests can run alongside the backend agents' test suites.
const root = new URL('../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const workerSource = read('public/sw.js');
const origin = 'https://frontend.test';
const cacheName = 'mk-breath-v5';
const appPath = '/atemuebung/app';

function html(body = 'app', status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function worker() {
  type Input = string | { url: string };
  type Event = {
    request?: { url: string; method: string; mode: string };
    respondWith: (response: Promise<Response>) => void;
    waitUntil: (work: Promise<unknown>) => void;
  };
  const handlers = new Map<string, (event: Event) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const calls: string[] = [];
  const key = (input: Input): string => new URL(typeof input === 'string' ? input : input.url, origin).href;
  let network: (url: string) => Promise<Response> = async () => html();
  let writeGate = Promise.resolve();
  let rejectWrites = false;
  let claimed = false;
  let skipped = false;

  function store(name = cacheName) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  runInNewContext(workerSource, {
    URL,
    Response,
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: Event) => void) => handlers.set(name, handler),
      skipWaiting: async () => {
        skipped = true;
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
    fetch: async (input: Input) => {
      const url = key(input);
      calls.push(url);
      return network(url);
    },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      open: async (name: string) => ({
        match: async (input: Input) => store(name).get(key(input))?.clone(),
        put: async (input: Input, response: Response) => {
          await writeGate;
          if (rejectWrites) throw new Error('quota exceeded');
          store(name).set(key(input), response.clone());
        },
      }),
    },
  });

  function dispatch(name: string, path = appPath, mode = 'navigate', method = 'GET') {
    let response: Promise<Response> | undefined;
    const work: Promise<unknown>[] = [];
    handlers.get(name)!({
      request: { url: key(path), mode, method },
      respondWith: (value) => {
        response = value;
      },
      waitUntil: (value) => {
        work.push(value);
      },
    });
    return { response, work, done: Promise.all(work) };
  }

  return {
    calls,
    stores,
    dispatch,
    seed: (path: string, response: Response, name = cacheName) => store(name).set(key(path), response),
    cached: (path: string) => store().get(key(path))?.clone(),
    network: (fn: typeof network) => {
      network = fn;
    },
    blockWrites: (gate: Promise<void>) => {
      writeGate = gate;
    },
    rejectWrites: () => {
      rejectWrites = true;
    },
    lifecycle: () => ({ claimed, skipped }),
  };
}

describe('breathing service worker', () => {
  test.each([
    '/assets/BreathingApp.DMMwhgQa.js',
    '/assets/RegistrationForm._z5VVMLs.js',
    '/assets/markus-sommer.CPXCjJ7G_Z2fNI3k.webp',
    '/assets/fonts/2ba7ad3501f95450.woff2',
    '/_astro/client.ChiJXsfH.js',
  ])('fingerprinted cache hit makes zero fetches: %s', async (path) => {
    const sw = worker();
    sw.seed(path, new Response('cached'));
    const event = sw.dispatch('fetch', path, 'cors');
    expect(await (await event.response!).text()).toBe('cached');
    await event.done;
    expect(sw.calls).toHaveLength(0);
  });

  test.each([
    '/favicon.svg',
    '/atemuebung.webmanifest',
    '/sw.js',
    '/assets/config.js',
    '/assets/fonts/barlow.woff2',
    '/images/portrait.CPXCjJ7G.jpg',
    '/assets/client.ChiJXsfH.js?v=mutable',
  ])('mutable cache hit revalidates and writes under waitUntil: %s', async (path) => {
    const sw = worker();
    sw.seed(path, new Response('old'));
    sw.network(async () => new Response('new'));
    const event = sw.dispatch('fetch', path, 'cors');
    expect(await (await event.response!).text()).toBe('old');
    expect(event.work).toHaveLength(1);
    await event.done;
    expect(sw.calls).toHaveLength(1);
    expect(await sw.cached(path)!.text()).toBe('new');
  });

  test('asset miss fetches once; its next request works offline', async () => {
    const sw = worker();
    const path = '/assets/BreathingApp.DMMwhgQa.js';
    sw.network(async () => new Response('chunk'));
    const first = sw.dispatch('fetch', path, 'cors');
    expect(await (await first.response!).text()).toBe('chunk');
    await first.done;
    sw.network(async () => {
      throw new Error('offline');
    });
    const next = sw.dispatch('fetch', path, 'cors');
    expect(await (await next.response!).text()).toBe('chunk');
    await next.done;
    expect(sw.calls).toHaveLength(1);
  });

  test('mutable asset remains usable offline', async () => {
    const sw = worker();
    sw.seed('/favicon.svg', new Response('icon'));
    sw.network(async () => {
      throw new Error('offline');
    });
    const event = sw.dispatch('fetch', '/favicon.svg', 'cors');
    expect(await (await event.response!).text()).toBe('icon');
    await event.done;
  });

  test.each(['/', '/event', '/event/evening', '/atemuebung', '/atemuebung/app/other', '/unknown'])(
    'non-app navigation is never intercepted, even with stale cached HTML: %s',
    async (path) => {
      const sw = worker();
      sw.seed(path, html('stale event'));
      sw.seed(appPath, html());
      const event = sw.dispatch('fetch', path);
      expect(event.response).toBeUndefined();
      expect(event.work).toHaveLength(0);
      await event.done;
      expect(sw.calls).toHaveLength(0);
    },
  );

  test.each([
    '/api',
    '/api/example.js',
    '/admin',
    '/admin/style.css',
    '/_actions',
    '/_actions/test.js',
    'https://other.test/file.js',
  ])('private/external requests bypass the worker: %s', (path) => {
    expect(worker().dispatch('fetch', path, 'cors').response).toBeUndefined();
  });

  test('POST and unrelated GET data bypass the worker', () => {
    const sw = worker();
    expect(sw.dispatch('fetch', appPath, 'navigate', 'POST').response).toBeUndefined();
    expect(sw.dispatch('fetch', '/data.json', 'cors').response).toBeUndefined();
  });

  test.each([appPath, `${appPath}/`, `${appPath}?source=installed`])(
    'app document caches canonically, then launches offline: %s',
    async (path) => {
      const sw = worker();
      const online = sw.dispatch('fetch', path);
      expect(await (await online.response!).text()).toBe('app');
      await online.done;
      sw.network(async () => {
        throw new Error('offline');
      });
      const offline = sw.dispatch('fetch', path);
      expect(await (await offline.response!).text()).toBe('app');
      await offline.done;
    },
  );

  test.each(['error', 'json', 'redirect', 'no-store', 'private'])(
    'unsuitable app response never overwrites good HTML: %s',
    async (kind) => {
      const sw = worker();
      sw.seed(appPath, html('good'));
      sw.network(async () => {
        const response =
          kind === 'error'
            ? html('error', 503)
            : kind === 'json'
              ? new Response('{}', { headers: { 'content-type': 'application/json' } })
              : html('bad');
        if (kind === 'redirect') Object.defineProperty(response, 'redirected', { value: true });
        if (kind === 'no-store' || kind === 'private') response.headers.set('cache-control', kind);
        return response;
      });
      const event = sw.dispatch('fetch');
      await event.response;
      await event.done;
      expect(await sw.cached(appPath)!.text()).toBe('good');
    },
  );

  test('404 asset response does not replace a cached success', async () => {
    const sw = worker();
    sw.seed('/favicon.svg', new Response('good'));
    sw.network(async () => new Response('missing', { status: 404 }));
    const event = sw.dispatch('fetch', '/favicon.svg', 'cors');
    await event.response;
    await event.done;
    expect(await sw.cached('/favicon.svg')!.text()).toBe('good');
  });

  test('waitUntil remains pending until the cache write finishes', async () => {
    const sw = worker();
    let release!: () => void;
    sw.blockWrites(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const event = sw.dispatch('fetch');
    expect(await (await event.response!).text()).toBe('app');
    let finished = false;
    void event.done.then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    release();
    await event.done;
    expect(await sw.cached(appPath)!.text()).toBe('app');
  });

  test('cache write failure does not turn a successful response into an error', async () => {
    const sw = worker();
    sw.rejectWrites();
    const event = sw.dispatch('fetch');
    expect(await (await event.response!).text()).toBe('app');
    await event.done;
    expect(sw.cached(appPath)).toBeUndefined();
  });

  test('activation deletes only this app’s old caches', async () => {
    const sw = worker();
    sw.seed(appPath, html(), 'mk-breath-v4');
    sw.seed('/unrelated', html(), 'another-app-v1');
    sw.seed(appPath, html());
    await sw.dispatch('activate').done;
    expect([...sw.stores.keys()].sort()).toEqual(['another-app-v1', cacheName]);
    expect(sw.lifecycle().claimed).toBe(true);
  });

  test('install validates document responses and tolerates asset misses', async () => {
    const sw = worker();
    sw.network(async (url) => (url.endsWith(appPath) ? html('error', 503) : new Response('missing', { status: 404 })));
    await sw.dispatch('install').done;
    expect(sw.cached(appPath)).toBeUndefined();
    expect(sw.cached('/favicon.svg')).toBeUndefined();
    expect(sw.lifecycle().skipped).toBe(true);
  });
});

function retentionTimer() {
  const component = read('src/components/islands/BreathingApp.svelte');
  const script = component.match(/<script lang="ts">([\s\S]*?)<\/script>/)![1];
  const ast = ts.createSourceFile('BreathingApp.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = ['startRetention', 'updateRetention', 'clearScheduled'];
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name!.text));
  expect(functions).toHaveLength(3);
  const source = ts.transpile(functions.map((node) => node.getText(ast)).join('\n'), {
    target: ts.ScriptTarget.ESNext,
  });
  let now = 0;
  let id = 0;
  let callbacks = 0;
  const tasks = new Map<number, { due: number; callback: () => void }>();
  const document = { hidden: false };
  const api = runInNewContext(
    `
    let phase = 'idle', timerSeconds = 0, retentionStartedAt = null;
    let timeoutHandle = null, intervalHandle = null;
    const chime = () => {};
    ${source}
    ({ start: startRetention, update: updateRetention,
       reset() { clearScheduled(); phase = 'idle'; timerSeconds = 0; },
       destroy: clearScheduled, seconds: () => timerSeconds })
  `,
    {
      document,
      performance: { now: () => now },
      window: {
        setTimeout: (callback: () => void, delay: number) => {
          tasks.set(++id, { due: now + delay, callback });
          return id;
        },
        clearTimeout: (handle: number) => tasks.delete(handle),
        clearInterval: () => {},
      },
    },
  ) as { start(): void; update(): void; reset(): void; destroy(): void; seconds(): number };

  return {
    ...api,
    tasks,
    callbacks: () => callbacks,
    nextDelay: () => [...tasks.values()][0]?.due - now,
    advance: (ms: number) => {
      const end = now + ms;
      while (tasks.size) {
        const [handle, task] = [...tasks.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        if (task.due > end) break;
        now = task.due;
        tasks.delete(handle);
        callbacks++;
        task.callback();
      }
      now = end;
    },
    jump: (ms: number) => {
      now += ms;
    },
    visibility: (hidden: boolean) => {
      document.hidden = hidden;
      api.update();
    },
  };
}

describe('retention scheduling (actual component functions)', () => {
  test('60 seconds uses 60 callbacks, not 3600 animation frames', () => {
    const timer = retentionTimer();
    timer.start();
    timer.advance(60_000);
    expect(timer.seconds()).toBe(60);
    expect(timer.callbacks()).toBe(60);
    expect(timer.tasks.size).toBe(1);
  });

  test('late callbacks catch up and align to the next second', () => {
    const timer = retentionTimer();
    timer.start();
    timer.jump(7_350);
    timer.update();
    expect(timer.seconds()).toBe(7);
    expect(timer.nextDelay()).toBe(650);
    timer.advance(650);
    expect(timer.seconds()).toBe(8);
  });

  test('hidden time is counted without callbacks; resume is immediate', () => {
    const timer = retentionTimer();
    timer.start();
    timer.advance(1_250);
    timer.visibility(true);
    expect(timer.tasks.size).toBe(0);
    timer.advance(30_000);
    expect(timer.callbacks()).toBe(1);
    timer.visibility(false);
    expect(timer.seconds()).toBe(31);
    expect(timer.nextDelay()).toBe(750);
  });

  test('reset/restart/destruction clear pending work and the elapsed baseline', () => {
    const timer = retentionTimer();
    timer.start();
    timer.advance(2_500);
    timer.reset();
    timer.visibility(false);
    expect(timer.tasks.size).toBe(0);
    expect(timer.seconds()).toBe(0);
    timer.start();
    timer.advance(1_000);
    expect(timer.seconds()).toBe(1);
    timer.destroy();
    expect(timer.tasks.size).toBe(0);
    timer.update();
    expect(timer.tasks.size).toBe(0);
  });

  test('visibility and BFCache listeners have matching cleanup', () => {
    const source = read('src/components/islands/BreathingApp.svelte');
    for (const name of ['visibilitychange', 'pageshow']) {
      expect(source).toContain(`addEventListener('${name}', updateRetention)`);
      expect(source).toContain(`removeEventListener('${name}', updateRetention)`);
    }
    expect(source).not.toContain('requestAnimationFrame');
  });
});

// Evaluate the checked-in sizes expressions in isolation (not a browser layout
// measurement). Commas inside min/clamp must not split source-size entries.
//
// Two spellings, because the two heroes build their markup differently: PageHero
// hands `sizes` to <Picture> as an attribute, while Hero (on demand, so its
// variants come from astro-integrations/hero-images.mjs) shares one `SIZES`
// constant across the <source>s and the <img>. Same expression either way, and
// that expression is what this asserts.
function imageSlot(component: string, viewport: number): number {
  const source = read(`src/components/blocks/${component}.astro`);
  const sizes = (source.match(/sizes="([^"]+)"/) ?? source.match(/const SIZES =\s*'([^']+)'/))![1];
  let depth = 0;
  let separator = -1;
  for (let index = 0; index < sizes.length; index++) {
    if (sizes[index] === '(') depth++;
    if (sizes[index] === ')') depth--;
    if (sizes[index] === ',' && depth === 0) {
      separator = index;
      break;
    }
  }
  const mobile = sizes.slice(0, separator).match(/^\(max-width: (\d+)em\) (.*)$/)!;
  const selected = viewport <= Number(mobile[1]) * 16 ? mobile[2] : sizes.slice(separator + 1);
  const expression = selected.replace(/([\d.]+)(vw|rem|px)/g, (_match, value, unit) =>
    String(Number(value) * (unit === 'vw' ? viewport / 100 : unit === 'rem' ? 16 : 1)),
  );
  return runInNewContext(expression, {
    calc: (value: number) => value,
    min: Math.min,
    clamp: (low: number, value: number, high: number) => Math.min(high, Math.max(low, value)),
  }) as number;
}

describe('responsive image size hints', () => {
  test.each([320, 390, 768, 860, 864, 865, 896, 897, 1024, 1320, 1920, 2560])(
    'image hints match their actual grid arithmetic at %ipx',
    (width) => {
      const gutter = Math.min(52, Math.max(20, 14.4 + width * 0.026));
      const content = Math.min(width, 1320) - 2 * gutter;
      const gap = Math.min(32, Math.max(16, 9.6 + width * 0.016));
      // Four of twelve tracks plus their three intervening gaps.
      const hero = width <= 896 ? content : 4 * ((content - 11 * gap) / 12) + 3 * gap;
      const pageHero = width <= 864 ? content : Math.min(352, content * 0.32);
      expect(imageSlot('Hero', width)).toBeCloseTo(hero, 8);
      expect(imageSlot('PageHero', width)).toBeCloseTo(pageHero, 8);
    },
  );

  test('wide-screen hints remain capped instead of growing with viewport', () => {
    expect(imageSlot('Hero', 2560)).toBe(384);
    expect(imageSlot('PageHero', 2560)).toBe(352);
  });
});

describe('frontend performance contracts', () => {
  test('prefetch is opt-in hover only, with no client prerender', () => {
    const config = read('astro.config.mjs');
    expect(config).toContain('prefetchAll: false');
    expect(config).toContain("defaultStrategy: 'hover'");
    expect(config).not.toContain('clientPrerender: true');
    for (const name of ['Header', 'Footer']) {
      const source = read(`src/components/${name}.astro`);
      const expression = source.match(/const prefetchPaths = (new Set\([^;]+\));/)![1];
      const allowed = runInNewContext(expression) as Set<string>;
      for (const path of allowed) {
        expect(['/warum-ich-den-maennerkreis-leite', '/atemuebung', '/impressum', '/datenschutz']).toContain(path);
      }
      for (const path of ['/', '/#faq', '/event', '/event/example', '/admin', '/atemuebung/app']) {
        expect(allowed.has(path)).toBe(false);
      }
      expect(source).toContain('data-astro-prefetch={prefetchPaths.has(');
    }
    expect(read('src/styles/utilities/_view-transitions.css')).toContain('@view-transition');
    expect(read('src/layouts/Layout.astro')).toContain("addEventListener('pagereveal'");
  });

  test('the on-demand hero ships build-time variants, never the runtime image endpoint', () => {
    // `astro:assets` resizes on request for a page that is not prerendered, and
    // that endpoint is libvips resident in the single web process — ~55MB of
    // native memory, outside the Bun heap where `--smol` cannot reach it. The
    // home page is on demand, so its photo is encoded during the build instead.
    const hero = read('src/components/blocks/Hero.astro');
    expect(hero).not.toMatch(/from 'astro:assets'/);
    expect(hero).toContain("from 'virtual:hero-images'");
    expect(read('astro.config.mjs')).toContain('heroImages(');

    // PageHero keeps <Picture>: every page that uses it is prerendered, so
    // Astro already emits those variants at build time.
    expect(read('src/components/blocks/PageHero.astro')).toMatch(/from 'astro:assets'/);
  });

  test('registration hydration serializes only id and capacity state', () => {
    expect(read('src/components/event/EventRegister.astro')).toContain(
      'event={{ id: event.id, is_full: event.is_full }}',
    );
    expect(read('src/components/islands/RegistrationForm.svelte')).toContain("Pick<EventDTO, 'id' | 'is_full'>");
  });

  test('no obsolete mutation observers; reveal recovery and essential-motion exemption remain', () => {
    expect(read('src/lib/motion.ts')).not.toContain('new MutationObserver');
    expect(read('src/lib/ambient.ts')).not.toContain('new MutationObserver');
    expect(read('src/lib/motion.ts')).toContain('clearMotionFallback()');
    expect(read('src/lib/ambient.ts')).toContain("section.querySelector('[data-motion-essential]')");
    expect(read('src/lib/client.ts')).toContain("classList.remove('motion-ready')");
  });
});
