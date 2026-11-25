import { readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'

import { contrast as ratio } from '../src/lib/brand/color'
import { declarations, parseTheme } from '../src/lib/brand/theme-tokens'
import { BRAND } from '../src/lib/shared/brand'

// The design system's promise (CLAUDE.md, "Design"): every text pair ≥ 4.5:1 on every
// ground in both modes, control lines and the accent (large or drawn) ≥ 3:1. Read
// from theme.css itself: the roles, resolved from the three primitives.

const css = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8')
const tokens = parseTheme(css)

const role = (name: string, mode: 'light' | 'dark'): string => {
  const hex = tokens.colours.find(c => c.name === name)?.[mode].hex

  expect(hex, `${name} (${mode}) has no hex`).toBeTruthy()

  return hex!
}

// The dark ground (`surface-dark`) is ink under the dark roles, in both modes.
const GROUNDS = {
  light: (): string[] => [role('ground', 'light'), role('ground-alt', 'light')],
  dark: (): string[] => [role('ground', 'dark'), role('ground-alt', 'dark'), BRAND.ink],
}

for (const mode of ['light', 'dark'] as const) {
  test(`${mode}: text ≥ 4.5:1, control lines and the accent ≥ 3:1 on every ground`, () => {
    for (const ground of GROUNDS[mode]()) {
      for (const text of ['fg', 'fg-soft', 'fg-muted', 'danger']) {
        expect(ratio(role(text, mode), ground), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5)
      }

      for (const drawn of ['line-bold', 'accent']) {
        expect(ratio(role(drawn, mode), ground), `${drawn} on ${ground}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  test(`${mode}: the label on a filled button reads, at rest and under the pointer`, () => {
    for (const fill of ['accent', 'accent-strong']) {
      expect(ratio(role('on-accent', mode), role(fill, mode)), `on-accent on ${fill}`).toBeGreaterThanOrEqual(4.5)
    }
  })
}

test('the dark ground re-declares each role with its dark value', () => {
  const squeeze = (value: string) => value.replace(/\s/g, '')
  const theme = new Map(declarations(css.slice(css.indexOf('@theme'), css.indexOf('@utility'))).map(d => [d.name, d.value]))
  const start = css.indexOf('@utility surface-dark')
  const dark = declarations(css.slice(start, css.indexOf('}', start))).filter(d => d.name !== '--color-surface')

  expect(dark.length).toBeGreaterThan(5)

  for (const { name, value } of dark) {
    expect(squeeze(theme.get(name)!), name).toEndWith(`,${squeeze(value)})`)
  }
})
