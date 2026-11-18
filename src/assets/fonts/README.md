# Fonts

All are Fontsource latin files, unchanged, under the SIL Open Font License 1.1:

- `cormorant-variable-latin.woff2`, `cormorant-variable-latin-italic.woff2`:
  Cormorant (© Christian Thalmann, <https://github.com/CatharsisFonts/Cormorant>),
  axis `wght`.
- `geist-400-latin.woff2`, `geist-600-latin.woff2`: Geist
  (© Vercel, <https://github.com/vercel/geist-font>), the static regular and semibold;
  the regular also serves weight 500, the semibold 700.

```bash
curl -sLo cormorant-variable-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/cormorant:vf@latest/latin-wght-normal.woff2"
curl -sLo cormorant-variable-latin-italic.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/cormorant:vf@latest/latin-wght-italic.woff2"
curl -sLo geist-400-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/geist@latest/latin-400-normal.woff2"
curl -sLo geist-600-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/geist@latest/latin-600-normal.woff2"
```

The Astro Fonts API serves them (`astro.config.mjs`, local provider). The mail
templates load their own files from `src/assets/mail/` (`cormorant-500.woff2` is the
Fontsource latin 500 file, `geist.woff2` the variable one; `ibm-plex-sans.woff2` and the others stay for mails already sent).
