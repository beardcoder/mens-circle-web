# Fonts

`vollkorn-variable-latin.woff2` is Vollkorn (SIL Open Font License 1.1, © Friedrich
Althausen, <http://vollkorn-typeface.com>), the Fontsource latin variable file (axis
`wght`, 400–900), unchanged:

```bash
curl -sLo vollkorn-variable-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/vollkorn:vf@latest/latin-wght-normal.woff2"
```

The site sets its figures lining (`lnum`, `--font-display--font-feature-settings` in
`theme.css`); the file's default figures are old-style.

Figtree still comes from Fontsource through the Astro Fonts API (`astro.config.mjs`).
The mail templates load their own static files from `src/assets/mail/`
(`vollkorn-500.woff2` is the Fontsource latin 500 file).
