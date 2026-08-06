# Drum Tab

A phone-first drum notation editor. Write grooves on a real five-line percussion
staff, hear a synthesized kit play them back, and rotate the phone for a
stripped-down, auto-scrolling view to play off.

**Live: <https://randomalt999.github.io/drum-tab/>**

Open it on your phone and use *Add to Home Screen* — it installs as a standalone
app and works with no connection.

## What it does

- **Library** — saved sheets, autosaved to the device. Duplicate or delete.
- **Editor** — tap the staff to place notes across eight voices (crash, hi-hat,
  ride, high/mid/floor tom, snare, kick). Tap a note to select it; the palette
  then edits that note instead of setting defaults for the next one. Double-tap
  to delete, drag to move in time or between voices.
- **Note values** 1/4, 1/8, 1/16 and rests; **articulations** plain, accent,
  ghost, and open (hi-hat and ride).
- **Bars** — meters 2/4 through 9/8, subdivision 16ths / 8ths / triplets,
  duplicate, reorder, clear, delete. A meter change applies from that bar on.
- **Parts** — song sections played in sequence. Rename, duplicate, reorder.
- **Transport** — play/pause, 30–300 BPM, speed 1× / .75× / .5× / .25×,
  metronome with click volume, loop between any two points (it may span bars),
  and a PART / SONG scope switch.
- **Undo/redo** — in the palette row, or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
- **Play mode** — full-bleed notation, no editing chrome. Auto-scrolls to the
  playing bar, keeps the screen awake, tap anywhere to pause. Rotating a phone
  to landscape enters it automatically.

Spacebar toggles playback anywhere outside a text field.

## Running it

```bash
npm install
npm run dev
```

`npm run build` produces the static site in `dist/`. Pushing to `main` builds it
and force-pushes the result to the `gh-pages` branch, which GitHub Pages serves
(see `.github/workflows/deploy.yml`).

## How it's built

No backend and no server state — everything lives in `localStorage` on the
device, under the versioned keys `drumtab.lib.v7` / `drumtab.cur.v7`.

- `src/notation/` — the layout engine. `constants.ts` holds staff geometry and
  the glyph offsets, which are measured from Noto Music's rendered ink bounds
  rather than derived: a music font's advance widths do not centre glyphs for
  you. `layout.ts` computes noteheads, stems, beams, flags and articulations for
  one bar; `Staff.tsx` draws the SVG. **If the music font is ever swapped, those
  offsets must be re-measured.**
- `src/audio/` — the kit is synthesized with Web Audio; no audio files ship.
  `timeline.ts` flattens the playback scope into a step list on the audio clock.
  A 25ms interval schedules a 200ms look-ahead; a separate `requestAnimationFrame`
  loop reads `currentTime` purely to drive the visual playhead. Audio timing is
  never derived from rAF.
- `src/App.tsx` — one logic class holding session state, the scheduler and the
  pointer gestures. Every mutation goes through `edit()`, which deep-clones the
  project before applying; undo/redo is just the pre-mutation copy.
- Fonts are self-hosted (Noto Music subset to the musical-symbols block, ~25KB,
  plus IBM Plex Mono) so the installed app renders noteheads offline.

Pointer coordinates go through the SVG's own inverse screen CTM, not
`getBoundingClientRect`. The staff is height-capped, so `preserveAspectRatio`
letterboxes the viewBox inside the element and rect-based math drifts — measured
at up to four slots on a wide viewport, which puts notes on the wrong beat.

## Credits

Fonts: [Noto Music](https://fonts.google.com/noto/specimen/Noto+Music) and
[IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono), both OFL.
