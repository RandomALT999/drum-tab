import { Component } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import type {
  Articulation,
  Bar,
  Cursor,
  Drag,
  Loop,
  NoteValue,
  Project,
  Selection,
  SheetState,
  Voice,
  VoiceId,
} from './model/types';
import { RES, blankBar, clone, newProj, uid } from './model/factory';
import { load, save } from './model/storage';
import { History } from './model/history';
import { Kit } from './audio/kit';
import { buildTimeline } from './audio/timeline';
import type { Step } from './audio/timeline';
import { NOTE0, PVBH, SIGS, SUBS, V, VBH, VBW, VI, yOf } from './notation/constants';
import { slotW, xOf } from './notation/layout';
import { ACCENT } from './config';
import { Library } from './screens/Library';
import { Editor } from './screens/Editor';
import { PlayMode } from './screens/PlayMode';
import { BottomSheet } from './ui/BottomSheet';
import type { SheetSpec } from './ui/BottomSheet';
import { Toast } from './ui/Toast';
import { applyUpdate, onUpdateReady } from './pwa';

export interface AppState {
  view: 'lib' | 'edit' | 'play';
  lib: Project[];
  curId: string;
  part: number;
  bar: number;
  dur: NoteValue;
  art: Articulation;
  sel: Selection | null;
  labels: boolean;
  met: boolean;
  metVol: number;
  scope: 'part' | 'song';
  speed: number;
  playing: boolean;
  cur: Cursor | null;
  /** count-in position, 0 = not counting */
  count: number;
  loop: Loop | null;
  loopArm: boolean;
  sheet: SheetState | null;
  toast: string | null;
  drag: Drag | null;
  wake: boolean;
  paneH: number;
  canUndo: boolean;
  canRedo: boolean;
  swUpdate: boolean;
  /** landscape on a short viewport — trim the chrome, widen the staff */
  compact: boolean;
}

interface Gesture {
  barId?: string;
  x?: number;
  y?: number;
  ux?: number;
  uy?: number;
  note?: import('./model/types').Note | null;
  moved?: boolean;
  done?: boolean;
}

export class App extends Component<Record<string, never>, AppState> {
  private kit = new Kit();
  private history = new History();
  private g: Gesture = {};
  private lastTap: { id: string; t: number } | null = null;

  /* scheduler */
  private TL: Step[] = [];
  private total = 0;
  private spq = 0.5;
  private gap = 2;
  private period = 2;
  private pass = 0;
  private idx = 0;
  private t0 = 0;
  private iv: ReturnType<typeof setInterval> | undefined;
  private raf = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /* dom */
  private pane: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  barEls: Record<string, HTMLElement> = {};
  private ro: ResizeObserver | undefined;
  private mq: MediaQueryList | undefined;
  private wl: WakeLockSentinel | null = null;

  private onResize = (): void => this.measure();
  private onKey = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.togglePlay();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
    }
  };
  /** Landscape on a short viewport: shrink the chrome so the staff gets the room. */
  private onOri = (): void => {
    const compact = !!this.mq?.matches;
    if (compact !== this.state.compact) this.setState({ compact }, () => this.measure());
  };
  private onVis = (): void => {
    if (document.visibilityState === 'visible') this.kit.resumeIfNeeded();
  };
  /** iOS needs a real gesture before any sound will come out. */
  private onFirstGesture = (): void => {
    void this.kit.unlock();
    window.removeEventListener('pointerdown', this.onFirstGesture);
    window.removeEventListener('touchend', this.onFirstGesture);
  };

  constructor(props: Record<string, never>) {
    super(props);
    const { lib, curId } = load();
    this.state = {
      view: 'edit',
      lib,
      curId,
      part: 0,
      bar: 0,
      dur: 4,
      art: 'normal',
      sel: null,
      labels: true,
      met: false,
      metVol: 70,
      scope: 'part',
      speed: 1,
      playing: false,
      cur: null,
      count: 0,
      loop: null,
      loopArm: false,
      sheet: null,
      toast: null,
      drag: null,
      wake: false,
      paneH: 0,
      canUndo: false,
      canRedo: false,
      swUpdate: false,
      compact: false,
    };
  }

  componentDidMount(): void {
    save(this.state.lib, this.state.curId);
    this.measure();
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => this.measure());
      if (this.pane) this.ro.observe(this.pane);
    }
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVis);
    // Noteheads are font glyphs; re-render once the music font is ready so the
    // first paint isn't measured against a fallback.
    if (document.fonts?.load)
      document.fonts.load('60px "Noto Music"').then(
        () => this.forceUpdate(),
        () => {},
      );
    this.mq = window.matchMedia('(max-height: 540px) and (orientation: landscape)');
    this.mq.addEventListener?.('change', this.onOri);
    if (this.mq.matches) this.setState({ compact: true });
    window.addEventListener('pointerdown', this.onFirstGesture, { passive: true });
    window.addEventListener('touchend', this.onFirstGesture, { passive: true });
    onUpdateReady(() => this.setState({ swUpdate: true }));
  }

  componentWillUnmount(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onFirstGesture);
    window.removeEventListener('touchend', this.onFirstGesture);
    document.removeEventListener('visibilitychange', this.onVis);
    this.ro?.disconnect();
    this.mq?.removeEventListener?.('change', this.onOri);
  }

  /* ---------- refs / measurement ---------- */

  setPane = (el: HTMLElement | null): void => {
    if (el && el !== this.pane) {
      this.pane = el;
      this.ro?.observe(el);
      requestAnimationFrame(() => this.measure());
    }
  };
  setScroller = (el: HTMLElement | null): void => {
    if (el) this.scroller = el;
  };

  /** The bar SVG is height-capped from the measured pane so a whole bar —
      kick line, beat numbers and all — fits without scrolling. */
  private measure(): void {
    // matchMedia's change event is the primary signal for `compact`; re-deriving
    // it here too means a missed or coalesced event can't leave the layout stale.
    const compact = !!this.mq?.matches;
    if (compact !== this.state.compact) this.setState({ compact });
    const el = this.pane;
    if (!el) return;
    const h = el.clientHeight;
    if (h && Math.abs(h - this.state.paneH) > 2) this.setState({ paneH: h });
  }
  /**
   * Height cap for a bar's SVG, measured from the pane rather than fixed, so a
   * whole bar — kick line and beat numbers included — fits without scrolling.
   * 148 is the legibility floor, but only when the pane can afford it: on a
   * landscape phone the pane is shorter than that, and a hard floor would push
   * the low voices out of view instead of scaling the bar down.
   */
  barCap(): string {
    const h = this.state.paneH;
    if (!h) return '196px';
    // 42 leaves room for the bar's own header row (badge / meter / subdivision),
    // the gap below it and the pane's padding, so the whole *block* fits the
    // pane — not just the staff.
    const roomy = h - 60;
    return (roomy >= 148 ? roomy : Math.max(72, h - 42)) + 'px';
  }

  /* ---------- project access ---------- */

  proj(): Project {
    return this.state.lib.find((p) => p.id === this.state.curId) || this.state.lib[0];
  }
  curPart() {
    const p = this.proj();
    return p.parts[Math.min(this.state.part, p.parts.length - 1)];
  }
  findBar(p: Project, id: string): Bar | null {
    for (const pt of p.parts) {
      const b = pt.bars.find((x) => x.id === id);
      if (b) return b;
    }
    return null;
  }
  selNote() {
    const s = this.state.sel;
    if (!s) return null;
    const bar = this.findBar(this.proj(), s.barId);
    if (!bar) return null;
    return bar.notes.find((n) => n.id === s.noteId) || null;
  }

  /* ---------- mutation ---------- */

  /**
   * The single mutation funnel: deep-clone the current project, apply, bump
   * `updated`, write through. Nothing mutates persisted state in place — which
   * is also what makes undo a matter of keeping the pre-mutation copy.
   */
  edit(fn: (p: Project) => void, label?: string, coalesceKey?: string): void {
    const before = this.proj();
    const lib = this.state.lib.map((p) => (p.id === this.state.curId ? clone(p) : p));
    const p = lib.find((x) => x.id === this.state.curId);
    if (!p) return;
    fn(p);
    p.updated = Date.now();
    this.history.push(before, coalesceKey);
    this.setState(
      { lib, canUndo: this.history.canUndo, canRedo: this.history.canRedo },
      () => {
        save(lib, this.state.curId);
        // Rebuild after commit — reading this.state here would see the old lib.
        if (this.state.playing) this.rebuild();
      },
    );
    if (label) this.flash(label);
  }

  private restoreProject(p: Project): void {
    const lib = this.state.lib.map((x) => (x.id === this.state.curId ? p : x));
    const part = Math.min(this.state.part, p.parts.length - 1);
    const bar = Math.min(this.state.bar, p.parts[part].bars.length - 1);
    this.setState(
      {
        lib,
        part,
        bar,
        sel: null,
        drag: null,
        canUndo: this.history.canUndo,
        canRedo: this.history.canRedo,
      },
      () => {
        save(lib, this.state.curId);
        if (this.state.playing) this.rebuild();
      },
    );
  }

  undo(): void {
    const prev = this.history.undo(this.proj());
    if (!prev) return;
    this.restoreProject(prev);
    this.flash('UNDO');
  }
  redo(): void {
    const next = this.history.redo(this.proj());
    if (!next) return;
    this.restoreProject(next);
    this.flash('REDO');
  }

  flash(t: string): void {
    clearTimeout(this.toastTimer);
    this.setState({ toast: t });
    this.toastTimer = setTimeout(() => this.setState({ toast: null }), 1100);
  }

  /* ---------- audio ---------- */

  private click(t: number, strong: boolean): void {
    this.kit.tick(t, strong, this.state.metVol / 100);
  }
  /** Count-in ignores a muted click so it's always audible. */
  private countTick(t: number, strong: boolean): void {
    this.kit.tick(t, strong, Math.max(this.state.metVol, 50) / 100);
  }
  audition(v: VoiceId, a: Articulation = 'normal'): void {
    this.kit.audition(v, a);
  }

  /* ---------- transport ---------- */

  rebuild(): void {
    const p = this.proj();
    const parts = this.state.scope === 'song' ? p.parts : [this.curPart()];
    const T = buildTimeline(p, parts, this.state.speed, this.state.loop);
    this.TL = T.steps;
    this.total = T.total;
    this.spq = T.spq;
    // Four ticks lead in before the first pass only. Repeats are seamless —
    // a gap between passes breaks time, which is the opposite of useful when
    // you are playing along to the loop.
    this.gap = 4 * T.spq;
    this.period = this.total;
  }

  togglePlay = (): void => {
    if (this.state.playing) this.stop();
    else void this.start();
  };

  async start(): Promise<void> {
    // start() awaits the audio unlock, so two quick taps can both get here.
    // Clear any scheduler already running or we end up with two of them.
    clearInterval(this.iv);
    cancelAnimationFrame(this.raf);
    // On iOS the context can still be suspended here, and a suspended context
    // reports currentTime 0 — every event would be scheduled in the past and
    // dropped. Resume before reading the clock.
    await this.kit.unlock();
    const ac = this.kit.ac();
    this.rebuild();
    if (!this.TL.length) return;
    this.pass = 0;
    this.idx = 0;
    this.t0 = ac.currentTime + 0.12 + this.gap;
    for (let i = 0; i < 4; i++) this.countTick(this.t0 - this.gap + i * this.spq, i === 0);
    this.setState({ playing: true, count: 1 }, () => {
      this.iv = setInterval(() => this.sched(), 25);
      this.loopRAF();
      if (this.state.view === 'play') void this.wakeOn();
    });
  }

  stop(): void {
    clearInterval(this.iv);
    cancelAnimationFrame(this.raf);
    this.wakeOff();
    if (this.state.playing || this.state.cur || this.state.count)
      this.setState({ playing: false, cur: null, count: 0 });
  }

  restart(): void {
    this.stop();
    setTimeout(() => void this.start(), 40);
  }

  /**
   * Look-ahead scheduler: every 25ms, push everything falling in the next
   * 200ms onto the audio clock. Timing therefore never depends on frame rate
   * or main-thread jitter.
   */
  private sched(): void {
    const look = 0.2;
    const now = this.kit.time;
    while (this.idx < this.TL.length) {
      const st = this.TL[this.idx];
      const when = this.t0 + this.pass * this.period + st.t;
      if (when > now + look) break;
      st.ev.forEach((n) => this.kit.hit(n.v, when, n.a));
      if (this.state.met && st.beatHead) this.click(when, st.beatIdx === 0);
      this.idx++;
      if (this.idx >= this.TL.length) {
        this.pass++;
        this.idx = 0;
      }
    }
  }

  /** Visual playhead only — never derive audio timing from rAF. */
  private loopRAF(): void {
    const step = (): void => {
      if (!this.state.playing) return;
      const t = this.kit.time - this.t0;
      const s = this.state;
      if (t < 0) {
        const c = Math.min(4, Math.floor((t + this.gap) / this.spq) + 1);
        if (s.count !== c || s.cur) this.setState({ count: c, cur: null });
      } else {
        const m = t % this.period;
        let i = 0;
        for (let k = 0; k < this.TL.length; k++) {
          if (this.TL[k].t <= m) i = k;
          else break;
        }
        const st = this.TL[i];
        const c = s.cur;
        if (st && (!c || c.barId !== st.barId || c.s !== st.s || s.count))
          this.setState({ cur: { barId: st.barId, s: st.s, partId: st.partId }, count: 0 }, () =>
            this.autoscroll(st.barId),
          );
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Scroll the playing bar to 30% from the top — but only when it has
      actually drifted, or it would jitter on every step. */
  private autoscroll(barId: string): void {
    if (this.state.view !== 'play') return;
    const sc = this.scroller;
    const el = this.barEls[barId];
    if (!sc || !el) return;
    const top = el.offsetTop - sc.clientHeight * 0.3;
    if (Math.abs(sc.scrollTop - top) > 24)
      sc.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  private async wakeOn(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wl = await navigator.wakeLock.request('screen');
        this.setState({ wake: true });
      }
    } catch {
      /* unsupported or denied — degrade silently */
    }
  }
  /** Play mode owns the wake lock — request on entry, release on exit. */
  enterPlayWake = (): void => void this.wakeOn();
  exitPlayWake = (): void => this.wakeOff();

  private wakeOff(): void {
    if (this.wl) {
      try {
        void this.wl.release();
      } catch {
        /* already released */
      }
      this.wl = null;
      this.setState({ wake: false });
    }
  }

  /* ---------- geometry / hit testing ---------- */

  vbX(): number {
    return this.state.labels ? 0 : 52;
  }
  viewBox(play = false): string {
    const x = this.vbX();
    return `${x} 0 ${VBW - x} ${play ? PVBH : VBH}`;
  }

  private nearVoice(uy: number): Voice {
    let best = V[0];
    let bd = 1e9;
    V.forEach((v) => {
      const d = Math.abs(yOf(v.st) - uy);
      if (d < bd) {
        bd = d;
        best = v;
      }
    });
    return best;
  }

  private hitNote(bar: Bar, ux: number, uy: number) {
    const sw = slotW(bar);
    let best: import('./model/types').Note | null = null;
    let bd = 1e9;
    bar.notes.forEach((n) => {
      const dx = xOf(bar, n.s) - ux;
      const dy = yOf(VI[n.v].st) - uy;
      const d = Math.hypot(dx * 0.8, dy);
      if (Math.abs(dx) < Math.max(sw * 0.6, 9) && Math.abs(dy) < 9 && d < bd) {
        bd = d;
        best = n;
      }
    });
    return best as import('./model/types').Note | null;
  }

  /**
   * Screen → SVG user units. Must go through the SVG's own inverse screen CTM:
   * the staff is height-capped, so preserveAspectRatio letterboxes the viewBox
   * inside the element and getBoundingClientRect math drifts by up to 1.6
   * slots at the right edge — enough to place a note on the wrong beat.
   */
  private pt(e: RPointerEvent<SVGSVGElement>): { ux: number; uy: number } {
    const svg = e.currentTarget;
    if (svg.createSVGPoint && svg.getScreenCTM) {
      const m = svg.getScreenCTM();
      if (m) {
        const p = svg.createSVGPoint();
        p.x = e.clientX;
        p.y = e.clientY;
        const q = p.matrixTransform(m.inverse());
        return { ux: q.x, uy: q.y };
      }
    }
    const r = svg.getBoundingClientRect();
    const x0 = this.vbX();
    return {
      ux: x0 + ((e.clientX - r.left) * (VBW - x0)) / r.width,
      uy: ((e.clientY - r.top) * VBH) / r.height,
    };
  }

  private slotAt(bar: Bar, ux: number): number {
    return Math.max(0, Math.min(RES(bar) - 1, Math.round((ux - NOTE0) / slotW(bar))));
  }

  /* ---------- note editing ---------- */

  addNote(barId: string, v: VoiceId, s: number): void {
    const id = uid();
    const st = this.state;
    this.edit((p) => {
      const bar = this.findBar(p, barId);
      if (!bar) return;
      // One note per voice per slot.
      bar.notes = bar.notes.filter((n) => !(n.v === v && n.s === s));
      bar.notes.push({ id, v, s, d: st.dur, a: st.art });
    });
    this.setState({ sel: { barId, noteId: id } });
    if (!st.playing) this.audition(v, st.art);
  }

  mutNote(barId: string, noteId: string, fn: (n: import('./model/types').Note, b: Bar) => void | null): void {
    this.edit((p) => {
      const bar = this.findBar(p, barId);
      if (!bar) return;
      const i = bar.notes.findIndex((n) => n.id === noteId);
      if (i < 0) return;
      if (fn(bar.notes[i], bar) === null) bar.notes.splice(i, 1);
    });
  }

  applyDur = (d: NoteValue): void => {
    const n = this.selNote();
    if (n && this.state.sel) this.mutNote(this.state.sel.barId, n.id, (x) => void (x.d = d));
    this.setState({ dur: d });
  };

  applyArt = (a: Articulation): void => {
    const n = this.selNote();
    if (n && this.state.sel) {
      this.mutNote(this.state.sel.barId, n.id, (x) => void (x.a = a));
      this.audition(n.v, a);
    }
    this.setState({ art: a });
  };

  toggleRest = (): void => {
    const n = this.selNote();
    if (n && this.state.sel) this.mutNote(this.state.sel.barId, n.id, (x) => void (x.rest = !x.rest));
    else this.flash('SELECT A NOTE');
  };

  /** A meter change applies to the tapped bar and every bar after it. */
  setSig(barId: string, n: number, dv: number): void {
    this.edit((p) => {
      for (const pt of p.parts) {
        const i = pt.bars.findIndex((x) => x.id === barId);
        if (i < 0) continue;
        for (let k = i; k < pt.bars.length; k++) {
          const b = pt.bars[k];
          b.n = n;
          b.dv = dv;
          const res = RES(b);
          b.notes = b.notes.filter((x) => x.s < res);
        }
        return;
      }
    }, n + '/' + dv);
  }

  /** Cycles 16THS → 8THS → TRIPLETS, re-timing existing notes proportionally. */
  cycleSub(barId: string): void {
    this.edit((p) => {
      const bb = this.findBar(p, barId);
      if (!bb) return;
      const i = SUBS.findIndex((s) => s.s === bb.sub);
      const nx = SUBS[(i < 0 ? 0 : i + 1) % SUBS.length].s;
      const old = bb.sub;
      bb.sub = nx;
      bb.notes.forEach((n) => {
        n.s = Math.round((n.s * nx) / old);
      });
      bb.notes = bb.notes.filter((n) => n.s < RES(bb));
    });
  }

  /* ---------- gestures: tap add / tap select / double-tap delete / drag move ---------- */

  onDown = (bar: Bar, e: RPointerEvent<SVGSVGElement>): void => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* not all browsers allow capture on SVG */
    }
    const q = this.pt(e);
    const note = this.hitNote(bar, q.ux, q.uy);
    this.g = { barId: bar.id, x: e.clientX, y: e.clientY, ux: q.ux, uy: q.uy, note, moved: false };
    if (this.state.loopArm) {
      const s = this.slotAt(bar, q.ux);
      const L = this.state.loop;
      if (!L || L.b) {
        this.setState({ loop: { a: { barId: bar.id, s }, b: null } });
        this.flash('LOOP START');
      } else {
        this.setState({ loop: { a: L.a, b: { barId: bar.id, s } }, loopArm: false }, () => {
          if (this.state.playing) this.restart();
        });
        this.flash('LOOP SET');
      }
      this.g.done = true;
    }
  };

  onMove = (bar: Bar, e: RPointerEvent<SVGSVGElement>): void => {
    const g = this.g;
    if (!g || g.done) return;
    if (!g.moved && Math.hypot(e.clientX - (g.x ?? 0), e.clientY - (g.y ?? 0)) > 7) g.moved = true;
    if (!g.moved || !g.note) return;
    const q = this.pt(e);
    const s = this.slotAt(bar, q.ux);
    const v = this.nearVoice(q.uy).id;
    const d = this.state.drag;
    if (!d || d.s !== s || d.v !== v) this.setState({ drag: { barId: bar.id, noteId: g.note.id, v, s } });
  };

  onUp = (bar: Bar, _e: RPointerEvent<SVGSVGElement>): void => {
    const g = this.g;
    this.g = {};
    if (!g || g.done) {
      this.setState({ drag: null });
      return;
    }
    const d = this.state.drag;
    if (g.moved && g.note && d) {
      this.setState({ drag: null, sel: { barId: bar.id, noteId: g.note.id } });
      this.mutNote(bar.id, g.note.id, (n) => {
        n.v = d.v;
        n.s = d.s;
      });
      this.audition(d.v, g.note.a);
      return;
    }
    this.setState({ drag: null });
    if (g.moved) return;

    if (!g.note) {
      // Outside the note field — clear the selection instead of placing.
      if ((g.ux ?? 0) < NOTE0 - 16 || (g.uy ?? 0) < 28 || (g.uy ?? 0) > 132) {
        this.setState({ sel: null });
        return;
      }
      this.addNote(bar.id, this.nearVoice(g.uy ?? 0).id, this.slotAt(bar, g.ux ?? 0));
      return;
    }

    const now = Date.now();
    const last = this.lastTap;
    if (last && last.id === g.note.id && now - last.t < 330) {
      this.lastTap = null;
      this.setState({ sel: null });
      this.mutNote(bar.id, g.note.id, () => null);
      this.flash('DELETED');
    } else {
      this.lastTap = { id: g.note.id, t: now };
      this.setState({ sel: { barId: bar.id, noteId: g.note.id }, dur: g.note.d, art: g.note.a });
      this.audition(g.note.v, g.note.a);
    }
  };

  onCancel = (): void => {
    this.g = {};
    this.setState({ drag: null });
  };

  /* ---------- library ---------- */

  openProject = (id: string): void => {
    this.stop();
    this.history.clear(id);
    this.setState(
      {
        curId: id,
        view: 'edit',
        part: 0,
        bar: 0,
        cur: null,
        loop: null,
        loopArm: false,
        sel: null,
        canUndo: false,
        canRedo: false,
      },
      () => save(this.state.lib, this.state.curId),
    );
  };

  newProject = (): void => {
    const np = newProj();
    const lib = [np, ...this.state.lib];
    this.history.clear(np.id);
    this.setState(
      {
        lib,
        curId: np.id,
        view: 'edit',
        part: 0,
        bar: 0,
        sel: null,
        loop: null,
        canUndo: false,
        canRedo: false,
      },
      () => save(lib, np.id),
    );
  };

  dupProject = (p: Project): void => {
    const c = clone(p);
    c.id = uid();
    c.title = p.title + ' copy';
    c.updated = Date.now();
    const lib = [...this.state.lib, c];
    this.setState({ lib }, () => save(lib, this.state.curId));
  };

  delProject = (p: Project): void => {
    if (this.state.lib.length < 2) return;
    const lib = this.state.lib.filter((y) => y.id !== p.id);
    const curId = this.state.curId === p.id ? lib[0].id : this.state.curId;
    if (curId !== this.state.curId) this.history.clear(curId);
    this.setState(
      {
        lib,
        curId,
        sel: null,
        canUndo: this.history.canUndo,
        canRedo: this.history.canRedo,
      },
      () => save(lib, curId),
    );
  };

  /* ---------- sheets ---------- */

  private buildSheet(): SheetSpec | null {
    const S = this.state.sheet;
    if (!S) return null;
    const st = this.state;
    const p = this.proj();
    const part = this.curPart();
    const close = () => this.setState({ sheet: null });
    const mono = { ff: 'IBM Plex Mono,monospace', fs: '16px', dy: '0px' };

    if (S.k === 'sig') {
      const cb = this.findBar(p, S.barId);
      return {
        title: 'TIME SIGNATURE · FROM BAR ' + ((cb && part.bars.indexOf(cb) + 1) || 1),
        close,
        items: SIGS.map((sg) => {
          const on = !!cb && cb.n === sg[0] && cb.dv === sg[1];
          return {
            g: sg[0] + '/' + sg[1],
            t: '',
            act: () => {
              this.setSig(S.barId, sg[0], sg[1]);
              close();
            },
            ...mono,
            fs: '17px',
            min: '74px',
            flex: '0 0 auto',
            bg: on ? this.acc : '#22222a',
            fg: on ? '#0d0d10' : '#ece7dd',
          };
        }),
      };
    }

    if (S.k === 'bar') {
      const idx = S.idx;
      return {
        title: 'BAR ' + (idx + 1),
        close,
        items: [
          {
            g: '⧉',
            t: 'DUPLICATE',
            ...mono,
            act: () => {
              this.edit((pp) => {
                const pt = pp.parts[st.part];
                const c = clone(pt.bars[idx]);
                c.id = uid();
                c.notes.forEach((n) => (n.id = uid()));
                pt.bars.splice(idx + 1, 0, c);
              }, 'BAR DUPLICATED');
              close();
            },
          },
          {
            g: '+',
            t: 'BLANK AFTER',
            ...mono,
            act: () => {
              this.edit((pp) => {
                const bs = pp.parts[st.part].bars;
                bs.splice(idx + 1, 0, blankBar(bs[idx]));
              });
              close();
            },
          },
          {
            g: '↑',
            t: 'MOVE LEFT',
            ...mono,
            act: () => {
              this.edit((pp) => {
                const bs = pp.parts[st.part].bars;
                if (idx > 0) bs.splice(idx - 1, 0, bs.splice(idx, 1)[0]);
              });
              close();
            },
          },
          {
            g: '↓',
            t: 'MOVE RIGHT',
            ...mono,
            act: () => {
              this.edit((pp) => {
                const bs = pp.parts[st.part].bars;
                if (idx < bs.length - 1) bs.splice(idx + 1, 0, bs.splice(idx, 1)[0]);
              });
              close();
            },
          },
          {
            g: '⌫',
            t: 'CLEAR NOTES',
            ...mono,
            act: () => {
              this.edit((pp) => {
                const bb = this.findBar(pp, S.barId);
                if (bb) bb.notes = [];
              });
              this.setState({ sel: null });
              close();
            },
          },
          {
            g: '×',
            t: 'DELETE BAR',
            ...mono,
            fs: '17px',
            bg: '#2a1c1e',
            fg: 'oklch(0.68 0.16 25)',
            act: () => {
              this.edit((pp) => {
                const bs = pp.parts[st.part].bars;
                if (bs.length > 1) bs.splice(idx, 1);
              });
              this.setState({ bar: 0, sel: null });
              close();
            },
          },
        ],
      };
    }

    if (S.k === 'part') {
      const nameVal = S.name !== undefined ? S.name : part.name;
      return {
        title: 'PART · ' + part.name.toUpperCase(),
        close,
        input: {
          val: nameVal,
          onChange: (v: string) => this.setState({ sheet: { k: 'part', name: v } }),
        },
        items: [
          {
            g: '✓',
            t: 'RENAME',
            ...mono,
            fs: '15px',
            bg: this.acc,
            fg: '#0d0d10',
            act: () => {
              const nm = nameVal.trim() || part.name;
              this.edit((pp) => {
                pp.parts[st.part].name = nm;
              });
              close();
            },
          },
          {
            g: '⧉',
            t: 'DUPLICATE',
            ...mono,
            act: () => {
              this.edit((pp) => {
                const c = clone(pp.parts[st.part]);
                c.id = uid();
                c.name = c.name + ' copy';
                c.bars.forEach((b) => {
                  b.id = uid();
                  b.notes.forEach((n) => (n.id = uid()));
                });
                pp.parts.splice(st.part + 1, 0, c);
              });
              this.setState({ part: st.part + 1, sel: null });
              close();
            },
          },
          {
            g: '↑',
            t: 'MOVE UP',
            ...mono,
            act: () => {
              this.edit((pp) => {
                if (st.part > 0) pp.parts.splice(st.part - 1, 0, pp.parts.splice(st.part, 1)[0]);
              });
              this.setState({ part: Math.max(0, st.part - 1) });
              close();
            },
          },
          {
            g: '↓',
            t: 'MOVE DOWN',
            ...mono,
            act: () => {
              this.edit((pp) => {
                if (st.part < pp.parts.length - 1)
                  pp.parts.splice(st.part + 1, 0, pp.parts.splice(st.part, 1)[0]);
              });
              this.setState({ part: Math.min(p.parts.length - 1, st.part + 1) });
              close();
            },
          },
          {
            g: '×',
            t: 'DELETE PART',
            ...mono,
            fs: '17px',
            bg: '#2a1c1e',
            fg: 'oklch(0.68 0.16 25)',
            act: () => {
              this.edit((pp) => {
                if (pp.parts.length > 1) pp.parts.splice(st.part, 1);
              });
              this.setState({ part: 0, bar: 0, sel: null });
              close();
            },
          },
        ],
      };
    }

    // addbar
    return {
      title: 'ADD BAR',
      close,
      items: [
        {
          g: '⧉',
          t: 'DUPLICATE LAST',
          ...mono,
          bg: this.acc,
          fg: '#0d0d10',
          min: '150px',
          act: () => {
            this.edit((pp) => {
              const pt = pp.parts[st.part];
              const c = clone(pt.bars[pt.bars.length - 1]);
              c.id = uid();
              c.notes.forEach((n) => (n.id = uid()));
              pt.bars.push(c);
            }, 'BAR ADDED');
            this.setState({ bar: part.bars.length });
            close();
          },
        },
        {
          g: '+',
          t: 'BLANK BAR',
          ...mono,
          fs: '18px',
          min: '150px',
          act: () => {
            this.edit((pp) => {
              const bs = pp.parts[st.part].bars;
              bs.push(blankBar(bs[bs.length - 1]));
            });
            this.setState({ bar: part.bars.length });
            close();
          },
        },
      ],
    };
  }

  get acc(): string {
    return ACCENT;
  }

  render() {
    const st = this.state;
    const sheet = this.buildSheet();
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowX: 'hidden',
          // in landscape the notch sits on one side, not the top
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {st.view === 'lib' && <Library app={this} />}
        {st.view === 'edit' && <Editor app={this} />}
        {st.view === 'play' && <PlayMode app={this} />}
        {sheet && <BottomSheet spec={sheet} />}
        {st.toast && <Toast text={st.toast} />}
        {st.swUpdate && (
          <Toast
            text="NEW VERSION · TAP TO UPDATE"
            interactive
            onClick={() => {
              this.setState({ swUpdate: false });
              applyUpdate();
            }}
          />
        )}
      </div>
    );
  }
}
