# Bundled fonts

The `.woff2` files in this directory are redistributed under the SIL Open Font
License, Version 1.1. The full licence text is in [`OFL.txt`](./OFL.txt) and
applies to both families below.

## Noto Music — `noto-music-subset.woff2`

Copyright The Noto Project Authors. Source:
<https://fonts.google.com/noto/specimen/Noto+Music>

Subset from the upstream TrueType release to the ranges the app actually draws
(`U+1D100–1D1FF` musical symbols, plus `U+0030–0039` for time-signature
numerals), which takes it from 178KB to ~25KB. Subsetting was done with
`fonttools`:

```bash
python -m fontTools.subset NotoMusic-Regular.ttf \
  --unicodes="U+1D100-1D1FF,U+0030-0039" \
  --layout-features="*" --flavor=woff2 \
  --output-file=noto-music-subset.woff2
```

The glyph offsets in `src/notation/constants.ts` are measured from this font's
rendered ink bounds. **Re-run those measurements if this file is ever
regenerated with a different subset or replaced with another music font** —
noteheads will be visibly off-centre otherwise.

Note that Noto Music does *not* contain Mathematical Bold digits
(`U+1D7D0–1D7D7`); the app draws time signatures with the family's own tabular
digits instead.

## IBM Plex Mono — `plex-mono-{400,500,600}.woff2`

Copyright © 2017 IBM Corp. with Reserved Font Name "Plex". Source:
<https://fonts.google.com/specimen/IBM+Plex+Mono>

The Latin subsets as served by Google Fonts, self-hosted so the installed app
renders with no network.
