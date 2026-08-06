import type { Project } from './types';
import { newProj } from './factory';

/* Keys are versioned so a schema change resets cleanly rather than
   half-loading an old shape. */
const LIB_KEY = 'drumtab.lib.v7';
const CUR_KEY = 'drumtab.cur.v7';

export interface Loaded {
  lib: Project[];
  curId: string;
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
    }),
  );
}

export function load(): Loaded {
  let lib: Project[] = [];
  let cur: string | null = null;
  try {
    lib = JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
  } catch {
    /* corrupt or unavailable storage — fall through to a fresh library */
  }
  try {
    cur = JSON.parse(localStorage.getItem(CUR_KEY) || 'null');
  } catch {
    /* same */
  }
  if (!Array.isArray(lib) || !lib.length) {
    const p0 = newProj();
    p0.title = 'Straight 8s';
    lib = [p0];
  }
  lib.forEach(migrate);
  if (!cur || !lib.some((x) => x.id === cur)) cur = lib[0].id;
  return { lib, curId: cur };
}

export function save(lib: Project[], curId: string): void {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(lib));
    localStorage.setItem(CUR_KEY, JSON.stringify(curId));
  } catch {
    /* quota or private mode — editing still works for the session */
  }
}
