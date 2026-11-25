import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'

import { mix } from '../src/lib/brand/color'
import { parseTheme } from '../src/lib/brand/theme-tokens'
import { BRAND, MAIL } from '../src/lib/shared/brand'

const tokens = parseTheme(readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8'))
const role = (name: string) => tokens.colours.find(c => c.name === name)!

test('brand.ts and the --p-* primitives in theme.css name the same three colours', () => {
  const fromTheme = Object.fromEntries(Object.entries(tokens.primitives).map(([name, { light }]) => [name, light]))

  expect({ ...BRAND } as Record<string, string>).toEqual(fromTheme)
})

test('the mixed tones of the mails are the theme\'s roles', () => {
  expect<string>(MAIL.muted).toBe(role('fg-muted').light.hex!)
  expect<string>(MAIL.mutedOnInk).toBe(role('fg-muted').dark.hex!)
  // The theme's lines are mixed with `transparent`; a mail needs them solid on its ground.
  expect<string>(MAIL.line).toBe(mix(BRAND.ink, BRAND.paper, 13))
  expect<string>(MAIL.lineStrong).toBe(mix(BRAND.ink, BRAND.paper, 24))
  expect<string>(MAIL.lineOnInk).toBe(mix(BRAND.paper, BRAND.ink, 14))
})

test('every colour in the mail templates is a brand colour', () => {
  const known = new Set<string>([...Object.values(BRAND), ...Object.values(MAIL)])

  const dirs = [
    { dir: new URL('../listmonk-templates/', import.meta.url), ext: '.html' },
    { dir: new URL('../src/lib/server/mail/', import.meta.url), ext: '.ts' },
  ]

  let files = 0

  for (const { dir, ext } of dirs) {
    for (const file of readdirSync(dir).filter(name => name.endsWith(ext))) {
      const html = readFileSync(new URL(file, dir), 'utf8')

      files++

      for (const hex of html.match(/#[0-9a-f]{6}\b/gi) ?? []) {
        expect(known.has(hex.toLowerCase()), `${file}: ${hex} is not in src/lib/shared/brand.ts`).toBe(true)
      }
    }
  }

  expect(files).toBeGreaterThanOrEqual(4)
})
