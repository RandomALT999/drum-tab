import type { Project } from './types';
import { newProj } from './factory';
import { fitDur } from '../notation/layout';

/* Keys are versioned so a schema change resets cleanly rather than
   half-loading an old shape. */
const LIB_KEY = 'drumtab.lib.v7';
const CUR_KEY = 'drumtab.cur.v7';
/** Written alongside every save, so a failed read has something to fall back to. */
const BAK_KEY = 'drumtab.lib.bak';

export interface Loaded {
  lib: Project[];
  curId: string;
  /** false when nothing was stored — the library is the bundled demo */
  restored: boolean;
}

/**
 * Bars used to be able to sit on an eighth-resolution grid, which made
 * sixteenths impossible to place in them. Doubling the resolution is lossless —
 * every existing slot maps to an even slot in the finer grid.
 */
function migrate(p: Project): void {
  p.parts?.forEach((pt) =>
    pt.bars?.forEach((b) => {
      if (b.sub === 2) {
        b.sub = 4;
        b.notes.forEach((n) => (n.s *= 2));
      }
      // Editing a note's value used to be able to put a quarter on an off-beat,
      // which cannot be drawn sensibly. Shorten such notes to a value that fits
      // where they already sit rather than moving them.
      b.notes.forEach((n) => (n.d = fitDur(b, n.s, n.d)));
    }),
  );
}

export function load(): Loaded {
  let lib: Project[] = [];
  let cur: string | null = null;
  const read = (k: string): Project[] => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  lib = read(LIB_KEY);
  // A torn or half-written primary must not cost the user their sheets.
  if (!lib.length) lib = read(BAK_KEY);
  try {
    cur = JSON.parse(localStorage.getItem(CUR_KEY) || 'null');
  } catch {
    /* same */
  }
  const restored = lib.length > 0;
  if (!restored) {
    const p0 = newProj();
    p0.title = 'Straight 8s';
    lib = [p0];
  }
  lib.forEach(migrate);
  if (!cur || !lib.some((x) => x.id === cur)) cur = lib[0].id;
  return { lib, curId: cur, restored };
}

export function save(lib: Project[], curId: string): void {
  // Refuse to write an empty library over a good one: every path that empties
  // `lib` is a bug, and persisting it would turn that bug into data loss.
  if (!lib.length) return;
  try {
    const json = JSON.stringify(lib);
    const prev = localStorage.getItem(LIB_KEY);
    if (prev && prev !== json) localStorage.setItem(BAK_KEY, prev);
    localStorage.setItem(LIB_KEY, json);
    localStorage.setItem(CUR_KEY, JSON.stringify(curId));
  } catch {
    /* quota or private mode — editing still works for the session */
  }
}
