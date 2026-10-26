import type { APIRoute } from 'astro';

import site from '../data/site.json';

export const prerender = true;

export const GET: APIRoute = ({ site: siteUrl }) => {
  const url = (path: string) => new URL(path, siteUrl).href;

  return new Response(
    `# ${site.siteName}

> ${site.description}

## Seiten

- [Startseite](${url('/')}): Männerkreis in Straubing, Niederbayern: Männer sitzen im Kreis, hören zu und sprechen offen, dazu einfache Atemübungen. Auf Spendenbasis, ohne Vorerfahrung.
- [Termine & Anmeldung](${url('/event')}): Aktuelle Termine, freie Plätze und Anmeldung.
- [Warum ich den Männerkreis leite](${url('/warum-ich-den-maennerkreis-leite')}): Markus Sommer erzählt, warum er den Männerkreis in Straubing gegründet hat und wie er die Abende leitet.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
