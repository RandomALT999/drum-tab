# Handoff: Drum Tab — iOS app icon (option 1c)

## Overview
App icon for **Drum Tab**, a drum-music creation app. The mark is a five-line percussion
staff carrying a beamed pair of eighth notes: **kick** (bottom space) beamed up to a
**ghost snare** (3rd space, notehead in parentheses = struck soft). No drumsticks, no
drumhead, no wordmark — the notation carries the whole idea.

This is option **1c** out of five explored in `Drum Tab Icon.dc.html`. The other four
(true tie, kick→snare slur, cropped/full-bleed, tie across a barline) are still in that
file if you need to compare.

## About the design files
The files in this bundle are **design references**. `Drum Tab Icon.dc.html` is an HTML
prototype of the exploration board — it is not production code and should not be shipped.
The production artifacts are the SVGs and PNGs listed under **Assets**: drop those into the
app's asset catalog (or re-draw them in your own tooling from the geometry table below).
If you are rebuilding the mark in code (SwiftUI `Path`, Canvas, Compose), use the geometry
table — every coordinate is exact and lives in a 100×100 unit square.

## Fidelity
**High fidelity.** Final colors, geometry and proportions. The exported 1024px SVG/PNG is
the master; everything else derives from it by scaling.

## The mark

Coordinate space: **100 × 100 units**, full-bleed square. Multiply by 10.24 for 1024px.
iOS masks the corners itself, so the exported square has **no corner radius and no
transparency**.

### Tile
| Property | Value |
|---|---|
| Background | radial gradient, center 50% / −6%, radius 125%: `#26262A` 0% → `#151518` 52% → `#0A0A0C` 100% |
| Top light | linear gradient 168°, `#FFFFFF` @ 7% → transparent at 38% |
| Optional brushed texture | 1px light stripes at a 3px period, white @ 3.2% — only legible above ~300px; omit below that (it aliases). Not in the exported assets. |
| Corner radius | none in the asset. iOS applies the squircle (≈22.5% of the tile if you must fake it). |

### Staff — 5 lines
`stroke #756C5E`, `stroke-width 2.1`, `stroke-linecap round`
```
M15 27 h70   M15 38.5 h70   M15 50 h70   M15 61.5 h70   M15 73 h70
```
Line spacing 11.5 units. Rounded line ends are intentional — they take the hard
engraving edge off inside the soft tile.

### Notes — fill `#C8B8A0`
The whole note cluster is scaled **1.18×** about (54, 45):
`transform="translate(54 45) scale(1.18) translate(-54 -45)"`
Untransformed geometry:
| Part | Geometry | Meaning |
|---|---|---|
| Kick notehead | ellipse cx 36, cy 67.25, rx 7.8, ry 5.8, rotate −20° about its center | bottom space = kick drum |
| Snare notehead | ellipse cx 64, cy 44.25, rx 7.8, ry 5.8, rotate −20° about its center | 3rd space = snare |
| Kick stem | rect x 42.3, y 33, w 2.7, h 34.8, rx 1.2 | stem up, right side of notehead |
| Snare stem | rect x 70.3, y 25.5, w 2.7, h 19.3, rx 1.2 | stems stop inside the beam so no notch shows |
| Beam | path `M42.3 31.5 73 23.5 73 30.1 42.3 38.1Z` | one beam = two eighth notes |
| Ghost parens | stroke `#C8B8A0`, width 1.8, linecap round: `M54.2 37.4Q50.8 44.25 54.2 51.1` and `M75.8 37.4Q79.2 44.25 75.8 51.1` | parenthesised notehead = ghost note |

Notation logic worth preserving if anyone edits this: on a percussion staff vertical
position means *instrument*, not pitch — bottom space is the kick, 3rd space the snare,
above the top line would be hi-hat. Two noteheads under one beam is a playable
kick-into-ghost-snare figure, not decoration.

## Appearance variants (iOS 18+ icon slots)
| Variant | Tile | Staff | Notes | File |
|---|---|---|---|---|
| Default / light | `#26262A`→`#151518`→`#0A0A0C` | `#756C5E` | `#C8B8A0` | `icon-1c-default.svg` |
| Dark | `#141418`→`#0A0A0C`→`#050506` | `#5D564B` | `#A3947E` | `icon-1c-dark.svg` |
| Tinted / monochrome | flat `#1C1C1E` | `#8A8A8D` | `#EDEDED` | `icon-1c-tinted-mono.svg` |
| Alt accent (bone) | same as default | `#8B8478` | `#EAE4D8` | `icon-1c-bone-accent.svg` |

Dark pulls the sand back ~18% so the mark doesn't glow on an OLED home screen. Tinted must
be grayscale only — iOS applies the user's hue itself.

## Size floor
The five lines fuse below roughly 40px. If you need a 29px asset (Settings, Spotlight),
cut a separate optical version rather than scaling this one down:
4 lines at 16.5-unit spacing, no stems, noteheads rx 8.5 / ry 6. That variant is drawn in
`Drum Tab Icon.dc.html` under "Size floor".

## Design tokens
```
--icon-tile-top      #26262A
--icon-tile-mid      #151518
--icon-tile-bottom   #0A0A0C
--icon-staff         #756C5E   /* = oklch(0.536 0.024 78) */
--icon-accent        #C8B8A0
--icon-accent-dark   #A3947E
--icon-accent-bone   #EAE4D8
--icon-mono          #EDEDED
--icon-tile-mono     #1C1C1E
--icon-corner        22.5% of tile (iOS squircle; asset itself is square)
```
No typography — the icon contains no text. The home-screen label is the system font
("Drum Tab", 11px / 500 in the mock).

## Assets
| File | Use |
|---|---|
| `icon-1c-default.svg` | master, vector, 1024×1024 viewBox |
| `icon-1c-1024.png` | App Store / asset catalog master |
| `icon-1c-180.png` `-120` `-80` `-60` `-40` | @3x/@2x home, spotlight, notification |
| `icon-1c-tinted-1024.png` | tinted slot master (grayscale) |
| `icon-1c-dark.svg`, `icon-1c-tinted-mono.svg`, `icon-1c-bone-accent.svg` | variant vectors |
| `Drum Tab Icon.dc.html` | the full exploration board: all five options, the iOS variant row, the home-screen mock, the 29px optical cut. Reference only. |

Nothing here is licensed artwork — the mark is original geometry, no third-party fonts or
music glyph sets (no Bravura/SMuFL dependency), so there is nothing to attribute.

## Not decided yet
- Which option ships (1c is one of five; 1a and 1e are the notationally strictest).
- Accent: `#C8B8A0` (sand) vs `#EAE4D8` (bone). Both exported.
- Whether the brushed-metal texture survives review at all.
- Launch screen / marketing lockup — not designed.
