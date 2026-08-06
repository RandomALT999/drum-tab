export type VoiceId =
  | 'crash'
  | 'hihat'
  | 'ride'
  | 'hitom'
  | 'midtom'
  | 'snare'
  | 'floor'
  | 'kick';

export type Articulation = 'normal' | 'accent' | 'ghost' | 'open';

/** Note value: 4 = quarter, 8 = eighth, 16 = sixteenth. */
export type NoteValue = 4 | 8 | 16;

export interface Note {
  id: string;
  /** voice id */
  v: VoiceId;
  /** slot index within the bar */
  s: number;
  /** note value */
  d: NoteValue;
  /** articulation */
  a: Articulation;
  rest?: boolean;
}

export interface Bar {
  id: string;
  /** meter numerator */
  n: number;
  /** meter denominator */
  dv: number;
  /** slots per beat: 4 = sixteenths, 2 = eighths, 3 = triplets */
  sub: number;
  notes: Note[];
}

export interface Part {
  id: string;
  name: string;
  bars: Bar[];
}

export interface Project {
  id: string;
  title: string;
  bpm: number;
  updated: number;
  parts: Part[];
}

export interface Voice {
  id: VoiceId;
  /** two-letter staff label */
  ab: string;
  /** human-readable name */
  nm: string;
  /** staff position, in half-spaces below the top line */
  st: number;
  /** notehead shape */
  hd: 'n' | 'x' | 'o';
  /** 1 = up-stem (hands), 0 = down-stem (feet) */
  up: 0 | 1;
  /** needs a ledger line */
  led?: 1;
  /** supports the OPEN articulation */
  ring?: 1;
}

/** `{barId, noteId}` — the currently selected note. */
export interface Selection {
  barId: string;
  noteId: string;
}

/** A loop endpoint: a slot within a bar. */
export interface LoopPoint {
  barId: string;
  s: number;
}

export interface Loop {
  a: LoopPoint;
  b: LoopPoint | null;
}

/** Live playhead position. */
export interface Cursor {
  partId: string;
  barId: string;
  s: number;
}

/** In-flight drag of a note to a new voice/slot. */
export interface Drag {
  barId: string;
  noteId: string;
  v: VoiceId;
  s: number;
}

export type SheetState =
  | { k: 'sig'; barId: string }
  | { k: 'bar'; idx: number; barId: string }
  | { k: 'part'; name?: string }
  | { k: 'addbar' }
  /** pick the cymbal feel a new part (or sheet) starts on */
  | { k: 'feel'; target: 'part' | 'project' };
