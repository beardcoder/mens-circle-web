/**
 * Generate `src/lib/server/og-fonts.ts` from the woff files in
 * `src/assets/fonts/`.
 *
 *   bun run og:fonts && bun run format
 *
 * Why the fonts are inlined rather than read from disk: the OG card is rendered
 * by the server bundle in `dist/server/chunks/`, and nothing there can point at
 * a file reliably. `new URL('../../assets/fonts/x.woff', import.meta.url)` is
 * NOT rewritten by Vite in the Astro SSR build — it survives verbatim into the
 * chunk and then resolves against `dist/server/chunks/`, where no font exists.
 * The card silently fell back to the static poster in every production build.
 * A path relative to the working directory would work, but only as long as the
 * process is started from the right one, in the container and out of it.
 *
 * Base64 in the bundle has no such condition attached. ~50KB, server side only
 * — the pages themselves ship nothing extra.
 *
 * Same contract as `bun run db:generate`: machine-written, committed, and
 * Prettier-formatted afterwards, so `format:check` stays green in CI.
 */
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);

const FACES = [
  { constant: 'BARLOW_CONDENSED_800', file: 'src/assets/fonts/barlow-condensed-800.woff', weight: 800 },
  { constant: 'BARLOW_CONDENSED_600', file: 'src/assets/fonts/barlow-condensed-600.woff', weight: 600 },
];

const faces = await Promise.all(
  FACES.map(async (face) => {
    const bytes = await readFile(new URL(face.file, ROOT));
    return { ...face, base64: bytes.toString('base64'), bytes: bytes.byteLength };
  }),
);

const body = `/**
 * Barlow Condensed, base64-encoded for the Open Graph card renderer.
 *
 * GENERATED FILE — do not edit. Run \`bun run og:fonts && bun run format\`
 * after replacing a woff in src/assets/fonts/. See scripts/generate-og-fonts.ts
 * for why the bytes are inlined instead of read from disk.
 *
 * Barlow is licensed OFL-1.1 (src/assets/fonts/LICENSE-Barlow.txt) — the same
 * two cuts the site itself serves as webfonts, so the card is set in the page's
 * own voice rather than an approximation of it.
 */

${faces
  .map(
    (face) =>
      `/** ${face.file} — weight ${face.weight}, ${face.bytes} bytes. */\nconst ${face.constant} =\n  '${face.base64}';`,
  )
  .join('\n\n')}

/** Decode once per process; the renderer hands these straight to satori. */
export const ogFonts = (): { weight: number; data: Buffer }[] => [
${faces.map((face) => `  { weight: ${face.weight}, data: Buffer.from(${face.constant}, 'base64') },`).join('\n')}
];
`;

const target = new URL('src/lib/server/og-fonts.ts', ROOT);
await writeFile(target, body, 'utf8');
console.log(
  `Wrote ${target.pathname} — ${faces.map((f) => `${f.constant} (${f.bytes} B)`).join(', ')}. Run \`bun run format\`.`,
);
