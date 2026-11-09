# Fonts

`fraunces-variable-latin.woff2` is Fraunces (SIL Open Font License 1.1, © The Fraunces
Project Authors, <https://github.com/undercasetype/Fraunces>), the Fontsource latin
"standard" variable file (axes `wght` and `opsz`), limited to the weights the site
sets so it stays near 60 kB:

```bash
curl -sLo std.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/fraunces:vf@latest/latin-standard-normal.woff2"
python -m venv venv && venv/bin/pip install fonttools brotli
venv/bin/python -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; \
f = instancer.instantiateVariableFont(TTFont('std.woff2'), {'wght': (500, 700)}); \
f.flavor = 'woff2'; f.save('fraunces-variable-latin.woff2')"
```

Figtree still comes from Fontsource through the Astro Fonts API (`astro.config.mjs`).
The mail templates load their own static files from `src/assets/mail/`.
