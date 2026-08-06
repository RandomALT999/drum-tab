import type { Loop, Note, Part, Project } from '../model/types';
import { RES } from '../model/factory';

export interface Step {
  partId: string;
  barId: string;
  s: number;
  /** seconds from the start of the (possibly looped) segment */
  t: number;
  beatHead: boolean;
  beatIdx: number;
  ev: Note[];
}

export interface Timeline {
  steps: Step[];
  /** seconds for one pass */
  total: number;
  /** seconds per quarter note, speed-adjusted */
  spq: number;
}

/**
 * Flattens the playback scope into a flat step list on the audio clock.
 *
 * Per bar of `n` beats over `dv` with `sub` slots per beat: each slot advances
 * (4/dv)/sub quarter notes and the bar advances n*4/dv quarters in total.
 * A loop region slices the list and re-bases `t` to zero.
 */
export function buildTimeline(
  proj: Project,
  parts: Part[],
  speed: number,
  loop: Loop | null,
): Timeline {
  const spq = 60 / (proj.bpm * speed);
  const tl: Step[] = [];
  let q = 0;

  parts.forEach((pt) =>
    pt.bars.forEach((bar) => {
      const res = RES(bar);
      const qPerSlot = 4 / bar.dv / bar.sub;
      for (let s = 0; s < res; s++) {
        tl.push({
          partId: pt.id,
          barId: bar.id,
          s,
          t: (q + s * qPerSlot) * spq,
          beatHead: s % bar.sub === 0,
          beatIdx: Math.floor(s / bar.sub),
          ev: bar.notes.filter((n) => n.s === s && !n.rest),
        });
      }
      q += (bar.n * 4) / bar.dv;
    }),
  );

  let a = 0;
  let b = tl.length - 1;
  if (loop && loop.a && loop.b) {
    const ia = tl.findIndex((x) => x.barId === loop.a.barId && x.s === loop.a.s);
    const ib = tl.findIndex((x) => x.barId === loop.b!.barId && x.s === loop.b!.s);
    if (ia >= 0 && ib >= 0) {
      a = Math.min(ia, ib);
      b = Math.max(ia, ib);
    }
  }

  const seg = tl.slice(a, b + 1);
  const t0 = seg.length ? seg[0].t : 0;
  const total = (b + 1 < tl.length ? tl[b + 1].t : q * spq) - t0;

  return {
    steps: seg.map((x) => ({ ...x, t: x.t - t0 })),
    total: Math.max(total, spq / 4),
    spq,
  };
}
