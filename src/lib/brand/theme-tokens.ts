/**
 * Reads the design tokens out of `src/styles/theme.css`, the one source of truth:
 * the primitives (`--p-*`), the colour roles with their light and dark values, the
 * type scale, space, sizes, radii, shadows and curves of the `@theme` block, and the
 * space per breakpoint on `:root`. The token export (`scripts/brand-export.ts`)
 * and the brand tests use it, so neither keeps a copy that could drift.
 * Pure: give it the file's text. A declaration's trailing comment is its note.
 */

import { mix } from './color'

export interface Declaration {
  name: string
  value: string
  note: string
}

interface ColourValue {
  /** Resolved hex, or `null` when the value has none (a mix with `transparent`). */
  hex: string | null
  /** The primitive it is (`paper`), if it is one unmixed. */
  primitive: string | null
}

interface Colour {
  name: string
  light: ColourValue
  dark: ColourValue
  /** No single hex in one of the modes. */
  derived: boolean
  note: string
}

interface TypeRole {
  name: string
  size: string
  lineHeight: string
  letterSpacing: string
  note: string
}

interface Space {
  name: string
  /** Value per breakpoint, from the smallest: `{ base: '1.75rem', '48rem': '2.5rem' }`. */
  steps: Record<string, string>
  note: string
}

export interface ThemeTokens {
  primitives: Record<string, { light: string, dark: string }>
  colours: Colour[]
  fonts: Declaration[]
  type: TypeRole[]
  space: Space[]
  sizes: Declaration[]
  radii: Declaration[]
  shadows: Declaration[]
  easings: Declaration[]
  breakpoints: Declaration[]
}

/** The text between the brace that opens after `start` and its partner. */
const block = (css: string, start: number): string => {
  const open = css.indexOf('{', start)
  let depth = 0

  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1

    if (css[i] === '}') {
      depth -= 1

      if (depth === 0) return css.slice(open + 1, i)
    }
  }

  return ''
}

/** Splits a block into custom property declarations, each with the comment that trails it on its line. */
export const declarations = (body: string): Declaration[] => {
  const found: Declaration[] = []
  const pattern = /(--[\w-]+)\s*:\s*/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(body))) {
    let depth = 0
    let end = pattern.lastIndex

    for (; end < body.length; end += 1) {
      const char = body[end]

      if (char === '(') depth += 1
      else if (char === ')') depth -= 1
      else if (char === ';' && depth === 0) break
    }

    const value = body
      .slice(pattern.lastIndex, end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const rest = body.slice(end + 1, body.indexOf('\n', end + 1) === -1 ? undefined : body.indexOf('\n', end + 1))
    const note = /^\s*\/\*\s*([\s\S]*?)\s*\*\//.exec(rest)?.[1] ?? ''

    found.push({ name: match[1], value, note })
    pattern.lastIndex = end + 1
  }

  return found
}

const HEX = /#[0-9a-f]{6}\b/i

/** `light-dark(a, b)` or one value into both modes; the comma that parts them is the one outside any bracket. */
const splitModes = (value: string): { light: string, dark: string } => {
  const inner = /^light-dark\((.*)\)$/.exec(value)?.[1]

  if (!inner) return { light: value, dark: value }

  let depth = 0

  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === '(') depth += 1
    else if (inner[i] === ')') depth -= 1
    else if (inner[i] === ',' && depth === 0) return { light: inner.slice(0, i).trim(), dark: inner.slice(i + 1).trim() }
  }

  return { light: value, dark: value }
}

const MIX = /^color-mix\(in srgb, var\(--p-([\w-]+)\) ([\d.]+)%, var\(--p-([\w-]+)\)\)$/

/** A primitive, two primitives mixed, or a hex; anything else (a mix with `transparent`) has no hex. */
const resolve = (value: string, primitives: ThemeTokens['primitives'], mode: 'light' | 'dark'): ColourValue => {
  const ref = /^var\(--p-([\w-]+)\)$/.exec(value.trim())

  if (ref) return { hex: primitives[ref[1]]?.[mode] ?? null, primitive: ref[1] }

  const mixed = MIX.exec(value.trim())
  const [a, b] = mixed ? [primitives[mixed[1]]?.[mode], primitives[mixed[3]]?.[mode]] : []

  if (mixed && a && b) return { hex: mix(a, b, Number(mixed[2])), primitive: null }

  return { hex: HEX.exec(value)?.[0].toLowerCase() ?? null, primitive: null }
}

const colour = (decl: Declaration, primitives: ThemeTokens['primitives']): Colour => {
  const modes = splitModes(decl.value)
  const light = resolve(modes.light, primitives, 'light')
  const dark = resolve(modes.dark, primitives, 'dark')

  return { name: decl.name.replace('--color-', ''), light, dark, derived: !light.hex || !dark.hex, note: decl.note }
}

const typeRoles = (decls: Declaration[]): TypeRole[] => {
  const byName = new Map(decls.map(d => [d.name, d]))

  return decls
    .filter(d => d.name.startsWith('--text-') && !d.name.includes('--', 2))
    .map(d => ({
      name: d.name.replace('--text-', ''),
      size: d.value,
      lineHeight: byName.get(`${d.name}--line-height`)?.value ?? '',
      letterSpacing: byName.get(`${d.name}--letter-spacing`)?.value ?? '',
      note: d.note,
    }))
}

/** The `--space-*` values on `:root`, base first, then each `@media (width >= …)` step. */
const spaceSteps = (root: string): Map<string, Record<string, string>> => {
  const steps = new Map<string, Record<string, string>>()
  const base = root.replace(/@media[^{]*\{[^}]*\}/g, '')

  const add = (step: string, body: string) => {
    for (const d of declarations(body).filter(x => x.name.startsWith('--space-'))) {
      steps.set(d.name, { ...steps.get(d.name), [step]: d.value })
    }
  }

  add('base', base)

  for (const [, width, body] of root.matchAll(/@media \(width >= ([\d.]+rem)\) \{([^}]*)\}/g)) add(width, body)

  return steps
}

const prefixed = (decls: Declaration[], prefix: string): Declaration[] =>
  decls.filter(d => d.name.startsWith(prefix) && !d.value.includes('initial'))

export const parseTheme = (css: string): ThemeTokens => {
  const theme = declarations(block(css, css.indexOf('@theme')))
  const rootStart = css.indexOf(':root {', css.indexOf('@layer base'))
  const root = block(css, rootStart)
  const primitives: ThemeTokens['primitives'] = {}

  for (const d of declarations(root.replace(/@media[^{]*\{[^}]*\}/g, '')).filter(x => x.name.startsWith('--p-'))) {
    const modes = splitModes(d.value)
    const light = HEX.exec(modes.light)?.[0].toLowerCase()
    const dark = HEX.exec(modes.dark)?.[0].toLowerCase()

    if (light && dark) primitives[d.name.replace('--p-', '')] = { light, dark }
  }

  const steps = spaceSteps(root)

  const space = prefixed(theme, '--spacing-').map((d) => {
    const source = /^var\((--space-[\w-]+)\)$/.exec(d.value)?.[1]

    return {
      name: d.name.replace('--spacing-', ''),
      steps: (source && steps.get(source)) || { base: d.value },
      note: d.note,
    }
  })

  return {
    primitives,
    colours: prefixed(theme, '--color-').map(d => colour(d, primitives)),
    fonts: prefixed(theme, '--font-'),
    type: typeRoles(theme),
    space,
    sizes: prefixed(theme, '--container-'),
    radii: prefixed(theme, '--radius-'),
    shadows: prefixed(theme, '--shadow-'),
    easings: prefixed(theme, '--ease-'),
    breakpoints: prefixed(theme, '--breakpoint-'),
  }
}
