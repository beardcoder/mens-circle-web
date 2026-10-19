import type { APIRoute } from 'astro';

import home from '../content/home.json';
import about from '../content/warum-ich-den-maennerkreis-leite.json';
import site from '../data/site.json';

export const prerender = true;

export const GET: APIRoute = ({ site: siteUrl }) => {
  const url = (path: string) => new URL(path, siteUrl).href;

  return new Response(
    `# ${site.siteName}

> ${site.description}

## Seiten

- [Startseite](${url('/')}): ${home.meta.description}
- [Termine & Anmeldung](${url('/event')}): Aktuelle Termine, freie Plätze und Anmeldung.
- [Warum ich den Männerkreis leite](${url('/warum-ich-den-maennerkreis-leite')}): ${about.meta.description}
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
