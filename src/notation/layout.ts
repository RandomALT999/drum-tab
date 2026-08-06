import type { Bar, Drag, Note } from '../model/types';
import { RES } from '../model/factory';
import {
  ACCDN,
  ACCUP,
  ACDX,
  ACDY,
  BEAMH,
  BEAMSTEP,
  BL,
  BR,
  DNEND,
  IV,
  NDX,
  NDY,
  NOTE0,
  ODX,
  ODY,
  R16DX,
  R16DY,
  R4DX,
  R4DY,
  R8DX,
  R8DY,
  SDX,
  SPAN,
  STUB,
  UPEND,
  VI,
  XDX,
  XDY,
  r1,
  yOf,
} from './constants';

export const beatW = (bar: Bar): number => SPAN / bar.n;
export const slotW = (bar: Bar): number => beatW(bar) / bar.sub;
export const xOf = (bar: Bar, s: number): number => NOTE0 + s * slotW(bar);

export interface Head {
  x: number;
  y: number;
  c: string;
  op: number;
}
export interface Mark {
  x: number;
  y: number;
  c: string;
}
export interface Beam {
  x: number;
  y: number;
  w: number;
  c: string;
}
export interface BeatNum {
  n: string;
  x: number;
  fill: string;
}

export interface BarRender {
  id: string;
  ledgers: string;
  nh: Head[];
  xh: Head[];
  oh: Head[];
  r4: Mark[];
  r8: Mark[];
  r16: Mark[];
  /** drag ghosts */
  gn: { x: number; y: number }[];
  gx: { x: number; y: number }[];
  accents: Mark[];
  rings: Mark[];
  selBox: { x: number; y: number }[];
  stems: string;
  stemsHot: string;
  beams: Beam[];
  flags: string;
  parens: string;
  trip: { x: number; y: number }[];
  /** playhead highlight */
  hl: { x: number; w: number; fill: string }[];
  loop: { d: string }[];
  showTS: boolean;
  tsNum: string;
  tsDen: string;
  beats: BeatNum[];
}

export interface LayoutCtx {
  /** playhead slot in this bar, or -1 */
  hot: number;
  drag: Drag | null;
  /** currently selected note, if it lives in this bar */
  selId: string | null;
  acc: string;
  softAcc: string;
  loop: { a: { barId: string; s: number }; b: { barId: string; s: number } | null } | null;
  showBeats: boolean;
  play: boolean;
  /** previous bar in reading order — a meter change re-shows the time signature */
  prev: Bar | null;
  /** global bar index; bar 0 always shows the time signature */
  gi: number;
}

interface Col {
  s: number;
  sx: number;
  top: number;
  bot: number;
  d: number;
  hot: boolean;
}

/**
 * Computes every piece of geometry for one bar. Ported from the design
 * prototype's `mkBar`; the constants were measured, not derived, so this
 * deliberately mirrors the original arithmetic step for step.
 */
export function buildBar(bar: Bar, ctx: LayoutCtx): BarRender {
  const res = RES(bar);
  const bw = beatW(bar);
  const sw = slotW(bar);
  const { hot, acc, softAcc } = ctx;
  const drag = ctx.drag && ctx.drag.barId === bar.id ? ctx.drag : null;
  const dragId = drag ? drag.noteId : null;

  const nh: Head[] = [];
  const xh: Head[] = [];
  const oh: Head[] = [];
  const r4: Mark[] = [];
  const r8: Mark[] = [];
  const r16: Mark[] = [];
  const gn: { x: number; y: number }[] = [];
  const gx: { x: number; y: number }[] = [];
  const accents: Mark[] = [];
  const rings: Mark[] = [];
  const selBox: { x: number; y: number }[] = [];
  const stems: string[] = [];
  const stemsHot: string[] = [];
  const beams: Beam[] = [];
  const flags: string[] = [];
  const parens: string[] = [];
  const trip: { x: number; y: number }[] = [];
  const led: string[] = [];

  const live = bar.notes.filter((n) => n.id !== dragId && n.s < res);

  live
    .filter((n) => !n.rest)
    .forEach((n) => {
      const v = VI[n.v];
      const y = yOf(v.st);
      const x = xOf(bar, n.s);
      const c = n.s === hot ? acc : IV;
      const op = n.a === 'ghost' ? 0.6 : 1;
      if (v.hd === 'o') oh.push({ x: r1(x - ODX), y: r1(y + ODY), c, op });
      else if (v.hd === 'x') xh.push({ x: r1(x - XDX), y: r1(y + XDY), c, op });
      else nh.push({ x: r1(x - NDX), y: r1(y + NDY), c, op });
      if (n.a === 'open' && v.ring) rings.push({ x: r1(x), y: r1(y - 13), c });
      if (v.led) led.push('M' + r1(x - 13) + ' ' + y + 'h26');
      if (n.a === 'accent')
        accents.push({ x: r1(x - ACDX), y: r1((v.up ? ACCUP : ACCDN) - ACDY), c });
      if (n.a === 'ghost') {
        parens.push('M' + r1(x - 13) + ' ' + (y - 6) + 'q-3.5 6 0 12');
        parens.push('M' + r1(x + 13) + ' ' + (y - 6) + 'q3.5 6 0 12');
      }
      if (!ctx.play && ctx.selId === n.id) selBox.push({ x: r1(x - 13), y: r1(y - 11) });
    });

  live
    .filter((n) => n.rest)
    .forEach((n) => {
      const x = xOf(bar, n.s);
      const cy = VI[n.v].up ? 84 : 116;
      const c = n.s === hot ? acc : 'rgba(236,231,221,.72)';
      if (n.d === 4) r4.push({ x: r1(x - R4DX), y: r1(cy + R4DY), c });
      else if (n.d >= 16) r16.push({ x: r1(x - R16DX), y: r1(cy + R16DY), c });
      else r8.push({ x: r1(x - R8DX), y: r1(cy + R8DY), c });
      if (!ctx.play && ctx.selId === n.id) selBox.push({ x: r1(x - 13), y: r1(cy - 11) });
    });

  if (drag) {
    const v = VI[drag.v];
    const x = xOf(bar, drag.s);
    const y = yOf(v.st);
    if (v.hd === 'n') gn.push({ x: r1(x - NDX), y: r1(y + NDY) });
    else gx.push({ x: r1(x - XDX), y: r1(y + XDY) });
  }

  /* Stems and beams. Up-stem (hands) and down-stem (feet) notes are grouped
     independently, and beamed only within a beat — never across a beat line. */
  const grp = (list: Note[], up: boolean): void => {
    const dir = up ? 1 : -1;
    const tip = up ? UPEND : DNEND;
    for (let b = 0; b < bar.n; b++) {
      const inBeat = list.filter((n) => Math.floor(n.s / bar.sub) === b);
      if (!inBeat.length) continue;
      const slots = [...new Set(inBeat.map((n) => n.s))].sort((a, c) => a - c);
      const cols: Col[] = slots.map((s) => {
        const ns = inBeat.filter((n) => n.s === s);
        const ys = ns.map((n) => yOf(VI[n.v].st));
        const x = xOf(bar, s);
        return {
          s,
          sx: r1(up ? x + SDX : x - SDX),
          top: Math.min(...ys),
          bot: Math.max(...ys),
          d: Math.max(...ns.map((n) => n.d)),
          hot: s === hot,
        };
      });
      cols.forEach((c) => {
        (c.hot ? stemsHot : stems).push('M' + c.sx + ' ' + (up ? c.bot : c.top) + 'V' + tip);
      });

      const bm = cols.filter((c) => c.d >= 8);
      if (bm.length > 1) {
        const x0 = bm[0].sx;
        const x1 = bm[bm.length - 1].sx;
        beams.push({
          x: r1(Math.min(x0, x1) - 0.9),
          y: up ? UPEND : DNEND - BEAMH,
          w: r1(Math.abs(x1 - x0) + 1.8),
          c: bm.some((c) => c.hot) ? acc : IV,
        });
        // Secondary (16th) beam: a run of >=2 consecutive 16ths gets a full
        // beam, an isolated 16th gets a partial stub pointing at its neighbour.
        // This is what lets 8ths and 16ths mix freely inside one beat.
        const y2 = up ? UPEND + BEAMSTEP : DNEND - BEAMH - BEAMSTEP;
        let i = 0;
        while (i < bm.length) {
          if (bm[i].d < 16) {
            i++;
            continue;
          }
          let j = i;
          while (j + 1 < bm.length && bm[j + 1].d >= 16) j++;
          if (j > i) {
            const a0 = bm[i].sx;
            const a1 = bm[j].sx;
            beams.push({
              x: r1(Math.min(a0, a1) - 0.9),
              y: y2,
              w: r1(Math.abs(a1 - a0) + 1.8),
              c: IV,
            });
          } else {
            const c = bm[i];
            const left = i > 0;
            const w = Math.min(
              STUB,
              Math.abs(left ? c.sx - bm[i - 1].sx : bm[i + 1].sx - c.sx) * 0.5,
            );
            beams.push({ x: r1(left ? c.sx - 0.9 - w : c.sx - 0.9), y: y2, w: r1(w + 1.8), c: IV });
          }
          i = j + 1;
        }
        if (bar.sub === 3) trip.push({ x: r1((x0 + x1) / 2), y: up ? UPEND - 5 : DNEND + 20 });
      } else if (bm.length === 1) {
        // A lone >=8th gets a flag instead of a beam. `dir` is applied to the y
        // deltas only — multiplying it into x as well mirrors the hook across
        // the stem and it points the wrong way.
        const c = bm[0];
        const fx = c.sx + 0.9;
        const hook = (y0: number): string =>
          'M' +
          fx +
          ' ' +
          y0 +
          'c8.4 ' +
          4.2 * dir +
          ' 10.5 ' +
          13.2 * dir +
          ' 1.8 ' +
          20.4 * dir +
          'c4.8 ' +
          -8.4 * dir +
          ' 2.4 ' +
          -13.2 * dir +
          ' -1.8 ' +
          -16.2 * dir +
          'Z';
        flags.push(hook(tip));
        if (c.d >= 16) flags.push(hook(tip + 9.6 * dir));
      }
    }
  };

  const solid = live.filter((n) => !n.rest);
  grp(
    solid.filter((n) => VI[n.v].up),
    true,
  );
  grp(
    solid.filter((n) => !VI[n.v].up),
    false,
  );

  const hl =
    hot >= 0 ? [{ x: r1(xOf(bar, hot) - sw / 2), w: r1(sw), fill: softAcc }] : [];

  const L = ctx.loop;
  const loop: { d: string }[] = [];
  if (L && L.a) {
    const inA = L.a.barId === bar.id;
    const inB = !!L.b && L.b.barId === bar.id;
    if (inA || inB) {
      const xa = inA ? r1(xOf(bar, L.a.s)) : BL + 4;
      const xb = inB && L.b ? r1(xOf(bar, L.b.s)) : BR - 4;
      loop.push({
        d:
          'M' +
          xa +
          ' 6v6M' +
          xb +
          ' 6v6M' +
          Math.min(xa, xb) +
          ' 6H' +
          Math.max(xa, xb),
      });
    }
  }

  const showTS = ctx.gi === 0 || !ctx.prev || ctx.prev.n !== bar.n || ctx.prev.dv !== bar.dv;

  const beats: BeatNum[] = [];
  if (ctx.showBeats && !ctx.play) {
    for (let i = 1; i <= bar.n; i++) {
      beats.push({
        n: String(i),
        x: r1(NOTE0 + (i - 1) * bw),
        fill:
          hot >= 0 && Math.floor(hot / bar.sub) === i - 1 ? acc : 'rgba(236,231,221,.3)',
      });
    }
  }

  return {
    id: bar.id,
    ledgers: led.join('') || 'M0 0',
    nh,
    xh,
    oh,
    r4,
    r8,
    r16,
    gn,
    gx,
    accents,
    rings,
    selBox,
    stems: stems.join('') || 'M0 0',
    stemsHot: stemsHot.join('') || 'M0 0',
    beams,
    flags: flags.join('') || 'M0 0',
    parens: parens.join('') || 'M0 0',
    trip,
    hl,
    loop,
    showTS,
    tsNum: String(bar.n),
    tsDen: String(bar.dv),
    beats,
  };
}
