import type { Tech, Voice, VoiceId } from '../model/types';

/* Eight voices on a standard percussion staff, in conventional positions:
   crash on the ledger above, hi-hat in the space above, ride on the top line,
   toms and snare inside, kick in the bottom space. Hands stem up and beam
   together; the kick stems down as a second voice. */
export const V: Voice[] = [
  { id: 'crash', ab: 'CR', nm: 'Crash', st: -2, hd: 'x', up: 1, led: 1 },
  { id: 'hihat', ab: 'HH', nm: 'Hi-Hat', st: -1, hd: 'x', up: 1, tech: ['open', 'half'] },
  { id: 'ride', ab: 'RD', nm: 'Ride', st: 0, hd: 'o', up: 1, tech: ['bell', 'crash'] },
  { id: 'hitom', ab: 'HT', nm: 'High Tom', st: 1, hd: 'n', up: 1 },
  { id: 'midtom', ab: 'MT', nm: 'Mid Tom', st: 2, hd: 'n', up: 1 },
  { id: 'snare', ab: 'SN', nm: 'Snare', st: 3, hd: 'n', up: 1, tech: ['rim', 'xstick'] },
  { id: 'floor', ab: 'FT', nm: 'Floor Tom', st: 5, hd: 'n', up: 1 },
  { id: 'kick', ab: 'BD', nm: 'Kick', st: 7, hd: 'n', up: 0 },
  /* Below the bottom line, stemmed down with the kick — both are feet, and
     drum charts put them in the same voice so they can sound together. */
  { id: 'hhfoot', ab: 'HF', nm: 'Hi-Hat Foot', st: 9, hd: 'x', up: 0 },
];

/** The technique row of the palette, in the order it is drawn. */
export const TECHS: { id: Tech; ab: string; nm: string }[] = [
  { id: 'open', ab: 'OPEN', nm: 'Open' },
  { id: 'half', ab: 'HALF', nm: 'Half-open' },
  { id: 'bell', ab: 'BELL', nm: 'Bell' },
  { id: 'crash', ab: 'CRASH', nm: 'Crashed ride' },
  { id: 'rim', ab: 'RIM', nm: 'Rim shot' },
  { id: 'xstick', ab: 'X-STK', nm: 'Cross-stick' },
];

export const VI: Record<VoiceId, Voice> = Object.fromEntries(V.map((v) => [v.id, v])) as Record<
  VoiceId,
  Voice
>;

/** Noto Music codepoints. */
export const CH = {
  clef: '\u{1D125}',
  r4: '\u{1D13D}',
  r8: '\u{1D13E}',
  r16: '\u{1D13F}',
  headN: '\u{1D158}',
  headX: '\u{1D143}',
  headO: '\u{1D145}',
  d4: '\u{1D15F}',
  d8: '\u{1D160}',
  d16: '\u{1D161}',
  accent: '\u{1D17B}',
} as const;

/* Staff space 16 (lines 60/76/92/108/124). Glyph offsets are measured from
   Noto Music's rendered ink bounds — a music font's advance widths do not
   centre glyphs for you. Re-measure these if the font is ever swapped. */
export const HS = 8;
export const TOP = 60;
export const BL = 66;
export const BR = 426;
export const NOTE0 = 134;
/**
 * First note slot when no time signature is drawn — a bar whose meter matches
 * the one before it. The clef's ink ends at ~80.5, so notes can start here and
 * reclaim the width the signature would have taken.
 */
export const NOTE0_TIGHT = 100;
export const SPAN = 280;
export const VBW = 440;
export const VBH = 172;
export const PVBH = 162;

export const NDX = 11.7;
export const NDY = 8.4;
export const XDX = 11.7;
export const XDY = 8.1;
export const ODX = 12.3;
export const ODY = 8.4;
export const SDX = 8.4;

export const R4DX = 7.7;
export const R4DY = 22.2;
export const R8DX = 7.7;
export const R8DY = 22;
export const R16DX = 9.2;
export const R16DY = 22;

export const ACDX = 10.2;
export const ACDY = 5.6;
export const ACCUP = 8;
/** Vertical step between stacked accent marks in one slot. */
export const ACC_STACK = 10;
export const ACCDN = 158;

export const UPEND = 16;
export const DNEND = 148;
export const BEAMH = 6;
export const BEAMSTEP = 10;
export const STUB = 9;

/* Time signature. Noto Music has no Mathematical Bold digits (U+1D7D0–1D7D7),
   which the prototype used — those were silently coming from a system fallback
   font. Noto Music's own digits are tabular (one advance for all ten), so
   text-anchor:middle centres every digit at one x with no per-digit fudge.
   Size re-derived so the numeral spans line 1 to line 3 exactly: 32/0.724em. */
export const TSX = 103;
export const TSFS = 44;
export const TSY_NUM = 92.4;
export const TSY_DEN = 124.4;

export const CLEF_X = 72.4;
export const CLEF_Y = 108.3;
export const CLEF_FS = 33;

export const AMB = 'oklch(0.8 0.14 72)';
export const IV = '#ece7dd';
export const MUT = 'rgba(236,231,221,.42)';
export const NONE = 'transparent';

export const SIGS: [number, number][] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 4],
  [6, 8],
  [7, 8],
  [9, 8],
];

export const SPEEDS = [1, 0.75, 0.5, 0.25];

/** y for a staff position given in half-spaces below the top line. */
export const yOf = (s: number): number => TOP + s * HS;

/** Round to 1dp — keeps the emitted SVG path data short. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Voice label baselines sit 3.2 below each notehead centre; x alternates
    between 26 and 48 so adjacent labels can't collide. */
export const LABELS = V.map((v) => ({
  ab: v.ab,
  x: [-2, 0, 2].includes(v.st) ? 26 : 48,
  y: yOf(v.st) + 3.2,
}));
