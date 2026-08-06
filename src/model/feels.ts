import type { Bar, Note, NoteValue, VoiceId } from './types';
import { uid } from './factory';
import { CH } from '../notation/constants';

/**
 * The cymbal pattern a new part starts on. Nothing else is filled in — the
 * kick and snare are yours to write.
 */
export interface Feel {
  id: 'eighths' | 'sixteenths' | 'triplets' | 'swing';
  label: string;
  glyph: string;
  /** grid resolution: 4 = sixteenths, 3 = triplets */
  sub: number;
  voice: VoiceId;
}

export const FEELS: Feel[] = [
  { id: 'eighths', label: '8THS', glyph: CH.d8, sub: 4, voice: 'hihat' },
  { id: 'sixteenths', label: '16THS', glyph: CH.d16, sub: 4, voice: 'hihat' },
  { id: 'triplets', label: 'TRIPLETS', glyph: CH.d8, sub: 3, voice: 'hihat' },
  { id: 'swing', label: 'SWING', glyph: CH.d4, sub: 3, voice: 'ride' },
];

/** Builds one bar of the given feel, cymbal line only. */
export function feelBar(feel: Feel, n = 4, dv = 4): Bar {
  const notes: Note[] = [];
  const add = (s: number, d: NoteValue): void => {
    notes.push({ id: uid(), v: feel.voice, s, d, a: 'normal' });
  };

  for (let b = 0; b < n; b++) {
    const base = b * feel.sub;
    if (feel.id === 'eighths') {
      add(base, 8);
      add(base + 2, 8);
    } else if (feel.id === 'sixteenths') {
      for (let i = 0; i < 4; i++) add(base + i, 16);
    } else if (feel.id === 'triplets') {
      for (let i = 0; i < 3; i++) add(base + i, 8);
    } else {
      // Jazz ride: "ding" on 1 and 3, "ding-da" on 2 and 4 — the second note
      // of the pair is the last triplet of the beat, which is what swings it.
      const swung = b % 2 === 1;
      add(base, swung ? 8 : 4);
      if (swung) add(base + 2, 8);
    }
  }

  return { id: uid(), n, dv, sub: feel.sub, notes };
}
