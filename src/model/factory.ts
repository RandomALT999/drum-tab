import type { Bar, Project } from './types';

export const uid = (): string => Math.random().toString(36).slice(2, 9);

/** Slots in a bar. */
export const RES = (b: Bar): number => b.n * b.sub;

/** A straight-8s groove, so a new sheet opens on something playable. */
export const seedBar = (): Bar => ({
  id: uid(),
  n: 4,
  dv: 4,
  sub: 4,
  notes: [
    { id: uid(), v: 'crash', s: 0, d: 8, a: 'accent' },
    { id: uid(), v: 'hihat', s: 2, d: 8, a: 'normal' },
    { id: uid(), v: 'hihat', s: 4, d: 8, a: 'normal' },
    { id: uid(), v: 'hihat', s: 6, d: 8, a: 'normal' },
    { id: uid(), v: 'hihat', s: 8, d: 8, a: 'normal' },
    { id: uid(), v: 'hihat', s: 10, d: 8, a: 'normal' },
    { id: uid(), v: 'hihat', s: 12, d: 8, a: 'normal' },
    { id: uid(), v: 'hihat', s: 14, d: 8, a: 'normal', k: 'open' },
    { id: uid(), v: 'snare', s: 4, d: 4, a: 'normal' },
    { id: uid(), v: 'snare', s: 12, d: 4, a: 'accent' },
    { id: uid(), v: 'kick', s: 0, d: 4, a: 'normal' },
    { id: uid(), v: 'kick', s: 8, d: 8, a: 'normal' },
    { id: uid(), v: 'kick', s: 10, d: 8, a: 'normal' },
    // the foot closing the hats on 2 and 4 — shows what the line below the
    // staff is for without anyone having to go looking
    { id: uid(), v: 'hhfoot', s: 4, d: 4, a: 'normal' },
    { id: uid(), v: 'hhfoot', s: 12, d: 4, a: 'normal' },
  ],
});

export const newProj = (first: Bar = seedBar()): Project => ({
  id: uid(),
  title: 'Untitled groove',
  bpm: 92,
  updated: Date.now(),
  parts: [{ id: uid(), name: 'Groove', bars: [first] }],
});

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
