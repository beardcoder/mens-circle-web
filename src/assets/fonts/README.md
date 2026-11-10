# Fonts

All are Fontsource latin files, unchanged, under the SIL Open Font License 1.1:

- `cormorant-variable-latin.woff2`, `cormorant-variable-latin-italic.woff2`:
  Cormorant (© Christian Thalmann, <https://github.com/CatharsisFonts/Cormorant>),
  axis `wght`.
- `ibm-plex-sans-400-latin.woff2`, `ibm-plex-sans-600-latin.woff2`: IBM Plex Sans
  (© IBM Corp., <https://github.com/IBM/plex>), the static regular and semibold;
  the regular also serves weight 500, the semibold 700.

```bash
curl -sLo cormorant-variable-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/cormorant:vf@latest/latin-wght-normal.woff2"
curl -sLo cormorant-variable-latin-italic.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/cormorant:vf@latest/latin-wght-italic.woff2"
curl -sLo ibm-plex-sans-400-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@latest/latin-400-normal.woff2"
curl -sLo ibm-plex-sans-600-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@latest/latin-600-normal.woff2"
```

The Astro Fonts API serves them (`astro.config.mjs`, local provider). The mail
templates load their own files from `src/assets/mail/` (`cormorant-500.woff2` is the
Fontsource latin 500 file, `ibm-plex-sans.woff2` the variable one).
