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
import { RES, clone, newProj, uid } from './model/factory';
import { FEELS, feelBar } from './model/feels';
import type { Feel } from './model/feels';
import { load, save } from './model/storage';
import { decodeSheet, encodeSheet, shareUrl } from './model/share';
import { History } from './model/history';
import { Kit } from './audio/kit';
import { buildTimeline } from './audio/timeline';
import type { Step } from './audio/timeline';
import { ACC_STACK, SIGS, V, VBH, VI, yOf } from './notation/constants';
import { readFade, writeFade } from './model/band';
import { BR_DEFAULT, canPlace, note0For, slotW, slotsFor, xOf } from './notation/layout';
import { ACCENT, SHOW_BEAT_NUMBERS } from './config';
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
  paneW: number;
  /** measured box of Play mode's scroller, for its own bar sizing */
  playPaneH: number;
  playPaneW: number;
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
  /** timestamps of recent tempo taps */
  private taps: number[] = [];
  /** whether the library came from storage rather than the bundled demo */
  private restored = false;

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
  pane: HTMLElement | null = null;
  private playPane: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  barEls: Record<string, HTMLElement> = {};
  private ro: ResizeObserver | undefined;
  private mq: MediaQueryList | undefined;
  private wl: WakeLockSentinel | null = null;

  /**
   * Re-measure once the viewport has stopped moving. Bar geometry is derived
   * from the measured pane, so an extra late pass is not free — it re-lays
   * every bar and nudges the notation after the rotation already looked
   * finished. Hence exactly one follow-up, and any pending one is cancelled so
   * a burst of events cannot queue several that land out of order.
   */
  private settleRaf = 0;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private settle = (): void => {
    cancelAnimationFrame(this.settleRaf);
    clearTimeout(this.settleTimer);
    const reset = (): void => {
      // Never fight the browser scrolling a focused field into view — the
      // on-screen keyboard moves the visual viewport, which lands here too.
      const el = document.activeElement;
      const editing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if (!editing && (window.scrollY || window.scrollX)) window.scrollTo(0, 0);
      this.measure();
    };
    reset();
    this.settleRaf = requestAnimationFrame(reset);
    this.settleTimer = setTimeout(reset, 250);
  };
  private onResize = (): void => this.settle();
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
    // Coming back from another app the context is often left suspended; without
    // this the transport looks alive but nothing sounds.
    if (document.visibilityState === 'visible') {
      this.kit.resumeIfNeeded();
      if (this.state.playing) this.kit.session(true);
    }
  };
  /** iOS needs a real gesture before any sound will come out. */
  private onFirstGesture = (): void => {
    void this.kit.unlock();
    window.removeEventListener('pointerdown', this.onFirstGesture);
    window.removeEventListener('touchend', this.onFirstGesture);
  };

  constructor(props: Record<string, never>) {
    super(props);
    const { lib, curId, restored } = load();
    this.restored = restored;
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
      paneW: 0,
      playPaneH: 0,
      playPaneW: 0,
    };
  }

  componentDidMount(): void {
    // Only persist the bundled demo. Writing on every mount meant a transient
    // read failure would immediately overwrite the user's sheets with a seed.
    if (!this.restored) save(this.state.lib, this.state.curId);
    this.measure();
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => this.measure());
      if (this.pane) this.ro.observe(this.pane);
    }
    window.addEventListener('resize', this.onResize);
    // iOS fires this separately, and sometimes before the viewport has settled
    window.addEventListener('orientationchange', this.onResize);
    // The visual viewport is what actually moves on iOS; the window resize
    // event does not always fire when it settles after a rotation.
    window.visualViewport?.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('scroll', this.onResize);
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
    void this.openShared();
  }

  componentDidUpdate(_p: Record<string, never>, prev: AppState): void {
    // Switching screens or toggling the key remounts the pane, so the measured
    // box belongs to the screen we just left. Re-measure before it is used.
    // Re-measure only. Clearing the refs here ran *after* React had already
    // attached the incoming screen's, so the new pane was never measured and
    // its bars fell back to default sizing.
    if (prev.view !== this.state.view || prev.labels !== this.state.labels)
      requestAnimationFrame(() => this.measure());
  }

  componentWillUnmount(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('scroll', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onFirstGesture);
    window.removeEventListener('touchend', this.onFirstGesture);
    document.removeEventListener('visibilitychange', this.onVis);
    this.ro?.disconnect();
    this.mq?.removeEventListener?.('change', this.onOri);
    cancelAnimationFrame(this.settleRaf);
    clearTimeout(this.settleTimer);
    clearTimeout(this.toastTimer);
  }

  /* ---------- refs / measurement ---------- */

  /* React passes null on unmount; taking it clears the reference instead of
     leaving a detached node that stepBar and autoscroll would still act on. */
  setPane = (el: HTMLElement | null): void => {
    if (el === this.pane) return;
    this.pane = el;
    if (!el) return;
    this.ro?.observe(el);
    requestAnimationFrame(() => this.measure());
  };
  /** Play mode's scroller doubles as the surface its bar cap is measured from. */
  setPlayPane = (el: HTMLElement | null): void => {
    if (el === this.playPane) return;
    this.playPane = el;
    this.scroller = el;
    if (!el) return;
    this.ro?.observe(el);
    requestAnimationFrame(() => this.measure());
  };

  /** The bar SVG is height-capped from the measured pane so a whole bar —
      kick line, beat numbers and all — fits without scrolling. */
  /** Content width — clientWidth includes padding, which would overcount the
      room available for tiling bars by a whole gutter. */
  private innerW(el: HTMLElement): number {
    const cs = getComputedStyle(el);
    return (
      el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
    );
  }

  /**
   * How far down the status bar / Dynamic Island band pushes us.
   *
   * iOS gives this two different shapes and swaps between them across a
   * rotation, which is the whole bug. Sometimes it shortens the viewport and
   * draws its own black band above us; sometimes it hands us the full screen
   * and composites the band over our own pixels. `env(safe-area-inset-top)`
   * reports zero in *both* — it believes the first story — so the app either
   * sits under the Island (frosted, unreadable) or jumps down by the height of
   * the band when iOS changes its mind.
   *
   * The geometry does not lie. If the viewport is as tall as the screen, the
   * band is over us and we must step out from under it ourselves; if it is
   * shorter, that missing strip IS the band, so we note its height for next
   * time and add nothing. Either way the app starts at the same place on the
   * glass, which is what stops the rotation nudge.
   */
  private bandPx = 0;
  private bandVar = '';
  private syncBand(): void {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || !!nav.standalone;
    const portrait = window.innerHeight > window.innerWidth;
    const long = Math.max(screen.height || 0, screen.width || 0);
    const short = Math.min(screen.height || 0, screen.width || 0);
    // Only in a Home Screen app, and only on a phone: a browser's own chrome
    // shortens the viewport too, and a tablet's top inset is a fifth of this.
    const armed = standalone && portrait && short > 0 && short < 500;
    const gap = long - Math.max(window.innerWidth, window.innerHeight);
    if (armed && gap > 8 && gap < 120) this.bandPx = gap;
    // 62px covers every current Dynamic Island until we have measured the real
    // one; being a few pixels generous costs nothing, being short leaves a
    // frosted sliver.
    const px = armed && Math.abs(gap) <= 8 ? this.bandPx || 62 : 0;
    // iOS does not stop frosting at the edge of the band — it feathers some
    // way further down the page, and how far is not knowable from script: the
    // effect is composited over the web view, so nothing we read back has been
    // touched by it. The band ruler measures it by eye; this is the answer it
    // saved. Unlike the band, the margin is there in both of iOS's shapes —
    // when it shortens the viewport instead, the feather lands on our first
    // pixels rather than on its own strip — so it is gated on `armed` alone.
    const fade = armed ? readFade() : 0;
    const top = `max(env(safe-area-inset-top, 0px), ${px}px)`;
    const v = top + ' + ' + fade;
    // Writing it unconditionally would relayout on every resize callback, and
    // the pane's ResizeObserver lands right back here.
    if (v === this.bandVar) return;
    this.bandVar = v;
    const s = document.documentElement.style;
    s.setProperty('--band-top', top);
    s.setProperty('--band-fade', fade + 'px');
  }

  /** Adopt a clearance measured by the band ruler, and re-lay the app to it. */
  setFade = (px: number): void => {
    writeFade(px);
    // syncBand short-circuits on an unchanged value, and the value it compares
    // is the one it last wrote — which the store has just gone behind.
    this.bandVar = '';
    this.measure();
  };

  private measure(): void {
    // Before anything is read: this sets the shell's top padding, so it decides
    // how tall the pane is.
    this.syncBand();
    // matchMedia's change event is the primary signal for `compact`; re-deriving
    // it here too means a missed or coalesced event can't leave the layout stale.
    const compact = !!this.mq?.matches;
    if (compact !== this.state.compact) this.setState({ compact });
    // Quantised so a one-pixel wobble — a scrollbar appearing, sub-pixel
    // rounding after a rotation — cannot re-lay every bar. Rounding DOWN, not
    // to nearest: these feed the bar height cap, and over-reporting the pane by
    // even 2px clips the staff against a pane that does not scroll.
    const q = (n: number): number => Math.max(0, Math.floor(n / 4) * 4);
    // Each dimension stands on its own. Gating one on the other meant a pane
    // that was briefly zero-width — negative once padding is subtracted — threw
    // away a perfectly good height and left the bars sized for another screen.
    const take = (
      el: HTMLElement | null,
      hKey: 'paneH' | 'playPaneH',
      wKey: 'paneW' | 'playPaneW',
    ): void => {
      if (!el) return;
      const next: Partial<AppState> = {};
      const h = q(el.clientHeight);
      const w = q(this.innerW(el));
      if (h > 0 && h !== this.state[hKey]) next[hKey] = h;
      if (w > 0 && w !== this.state[wKey]) next[wKey] = w;
      if (Object.keys(next).length) this.setState(next as Pick<AppState, typeof hKey>);
    };
    take(this.playPane, 'playPaneH', 'playPaneW');
    take(this.pane, 'paneH', 'paneW');
  }
  /**
   * Height cap for a bar's SVG, measured from the pane rather than fixed, so a
   * whole bar — kick line and beat numbers included — fits without scrolling.
   * 148 is the legibility floor, but only when the pane can afford it: on a
   * landscape phone the pane is shorter than that, and a hard floor would push
   * the low voices out of view instead of scaling the bar down.
   */
  /**
   * How to tile bars across the pane: the most that fit one row while a whole
   * row still fits the pane's height, with each bar sized to its viewBox
   * aspect. Deriving width from a height cap instead left the SVG in a box far
   * wider than the cap allowed, and preserveAspectRatio pillarboxed the staff —
   * a landscape phone drew a 330px staff inside an 1180px box.
   */
  barLayout(play = false): { width: string; cap: string } {
    const w = play ? this.state.playPaneW : this.state.paneW;
    const h = play ? this.state.playPaneH : this.state.paneH;
    if (!w || !h) return { width: '100%', cap: (play ? 240 : 196) + 'px' };
    const gap = play ? 16 : this.state.compact ? 12 : 14;
    // room for the bar's own caption row above the staff
    const head = play ? 24 : 34;
    // Landscape editing scrolls sideways through bars, so a bar is sized to
    // fill the pane's height and gets as long as that allows — rather than
    // being squeezed narrow to fit several across.
    if (this.state.compact) {
      // caption row (28) + its margin + the pane's own padding
      const cap = Math.max(90, h - (play ? 24 : 30) - 8);
      // exactly one bar per screen — a partial next bar just shows its caption
      return { width: '100%', cap: cap + 'px' };
    }
    // only the tiling branch needs this, and it costs a full scan of the notes
    const aspect = (this.br(play) + 14 - this.vbX()) / this.vbBox(play).h;
    let bw = w;
    for (let n = 1; n <= 4; n++) {
      bw = (w - gap * (n - 1)) / n;
      if (bw / aspect + head <= h) break;
    }
    // min() guards the case where a vertical scrollbar appears after the
    // measurement and narrows the content box — the bar can never out-grow it.
    return {
      width: `min(100%, ${Math.floor(bw)}px)`,
      cap: Math.floor(bw / aspect) + 'px',
    };
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
    this.setState({ lib, canUndo: this.history.canUndo, canRedo: this.history.canRedo }, () => {
      save(lib, this.state.curId);
      // Rebuild after commit — reading this.state here would see the old lib.
      if (this.state.playing) this.rebuild();
    });
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
        if (this.state.playing) this.rebuild(true);
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

  /**
   * Tempo from tapping in time. Uses the median of the recent gaps rather than
   * the mean, so one clumsy tap doesn't drag the whole reading; gaps longer
   * than two seconds start a fresh count.
   */
  tapTempo(): void {
    const now = performance.now();
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 6) this.taps.shift();
    if (this.taps.length < 2) {
      this.flash('KEEP TAPPING');
      return;
    }
    const gaps: number[] = [];
    for (let i = 1; i < this.taps.length; i++) gaps.push(this.taps[i] - this.taps[i - 1]);
    gaps.sort((a, b) => a - b);
    const mid = gaps[Math.floor(gaps.length / 2)];
    const bpm = Math.max(30, Math.min(300, Math.round(60000 / mid)));
    this.edit((pp) => void (pp.bpm = bpm), undefined, 'bpm');
  }

  /** Pack the current sheet into a link and hand it to the share sheet. */
  shareSheet = async (p: Project = this.proj()): Promise<void> => {
    const payload = await encodeSheet(p);
    const url = shareUrl(payload);
    if (url.length > 8000) {
      this.flash('SHEET TOO BIG TO LINK');
      return;
    }
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: p.title, url });
        return;
      }
    } catch {
      /* dismissed, or unavailable — fall back to the clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      this.flash('LINK COPIED');
    } catch {
      this.flash('COULD NOT COPY LINK');
    }
  };

  /**
   * Accepts a full shared link or the bare payload. iOS never deep-links into
   * an installed home-screen app, so a link tapped in Messages opens Safari —
   * pasting it here is how it reaches the installed copy.
   */
  async importShared(raw: string): Promise<void> {
    const t = raw.trim();
    const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(t);
    await this.addShared(m ? m[1] : t);
  }

  /** A #s=… fragment means someone opened a shared link. */
  private async openShared(): Promise<void> {
    const m = /^#s=(.+)$/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    await this.addShared(m[1]);
  }

  private async addShared(payload: string): Promise<void> {
    const p = await decodeSheet(payload);
    if (!p) {
      this.flash('LINK NOT READABLE');
      return;
    }
    const lib = [p, ...this.state.lib];
    this.history.clear(p.id);
    this.setState(
      { lib, curId: p.id, view: 'edit', part: 0, bar: 0, sel: null, loop: null },
      () => {
        save(lib, p.id);
        this.flash('SHEET ADDED');
      },
    );
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

  /**
   * @param keepPosition rebuild in place during playback, preserving where the
   * playhead is. Without it a tempo change kept the old `t0` while the period
   * changed underneath, so the playhead jumped and the scheduler re-fired
   * everything from the current index — the tempo appeared to run away.
   */
  rebuild(keepPosition = false): void {
    const now = this.kit.time;
    let frac = 0;
    if (keepPosition && this.period > 0) {
      const t = now - this.t0;
      if (t > 0) frac = (t % this.period) / this.period;
    }
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
    if (keepPosition && this.TL.length) {
      const at = frac * this.period;
      this.pass = 0;
      this.t0 = now - at;
      const i = this.TL.findIndex((st) => st.t >= at);
      this.idx = i < 0 ? 0 : i;
    }
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
    this.kit.session(true);
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
    this.kit.panic();
    this.kit.session(false);
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
          this.setState(
            { cur: { barId: st.barId, s: st.s, partId: st.partId }, count: 0 },
            () => this.autoscroll(st.barId),
          );
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Scroll the playing bar to 30% from the top — but only when it has
      actually drifted, or it would jitter on every step. */
  /**
   * Follows the playhead every frame instead of firing one smooth scroll per
   * bar. A per-bar scroll lands late and then jerks to catch up; positioning
   * directly from the current bar's own progress keeps it continuous and on
   * time. Runs in the editor too, not just Play mode.
   */
  private autoscroll(barId: string): void {
    const sc = this.state.view === 'play' ? this.scroller : this.pane;
    const el = this.barEls[barId];
    if (!sc || !el) return;
    if (this.state.compact) {
      // Landscape lays bars out left to right, so follow the playhead sideways.
      const max = sc.scrollWidth - sc.clientWidth;
      const left = Math.max(0, Math.min(max, el.offsetLeft - sc.clientWidth * 0.28));
      if (Math.abs(sc.scrollLeft - left) > 0.5) sc.scrollLeft = left;
      return;
    }
    const max = sc.scrollHeight - sc.clientHeight;
    const top = Math.max(0, Math.min(max, el.offsetTop - sc.clientHeight * 0.3));
    if (Math.abs(sc.scrollTop - top) > 0.5) sc.scrollTop = top;
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
  /**
   * Step the notation pane one bar left or right. Landscape shows one bar at a
   * time and the staff keeps its drag gestures, so this is how you move
   * between bars there without a swipe.
   */
  stepBar = (dir: 1 | -1): void => {
    const sc = this.pane;
    if (!sc) return;
    const w = sc.clientWidth;
    const max = sc.scrollWidth - w;
    sc.scrollTo({
      left: Math.max(0, Math.min(max, sc.scrollLeft + dir * w)),
      behavior: 'smooth',
    });
  };

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

  /**
   * Vertical extent actually needed by the bars on screen. The full 0–172 box
   * reserves room for accents above, accents below the kick and the beat-number
   * row, and that dead space is what limits how long a bar can be: the wider it
   * gets the taller it gets, so on a landscape phone it ran out of height at
   * ~65% of the width. Cropping to the content lets it fill the row.
   */
  private vbBox(play: boolean): { top: number; h: number } {
    const p = this.proj();
    const bars = play
      ? (this.state.scope === 'song' ? p.parts : [this.curPart()]).flatMap((pt) => pt.bars)
      : this.curPart().bars;
    let up = 0;
    let down = 0;
    bars.forEach((b) => {
      const tally = new Map<string, number>();
      b.notes.forEach((n) => {
        if (n.a !== 'accent' || n.rest) return;
        const k = n.s + ':' + VI[n.v].up;
        const c = (tally.get(k) ?? 0) + 1;
        tally.set(k, c);
        if (VI[n.v].up) up = Math.max(up, c);
        else down = Math.max(down, c);
      });
    });
    const beats = !play && !this.state.compact && SHOW_BEAT_NUMBERS;
    // ACC_STACK is the step layout.ts stacks marks by; keeping the reservation
    // on the same constant stops the box drifting out of step with the drawing.
    const top = up ? 0 - (up - 1) * ACC_STACK : 12;
    const dnBottom = 164 + (down - 1) * ACC_STACK;
    const bottom = beats ? Math.max(VBH, dnBottom) : down ? dnBottom : 152;
    return { top, h: bottom - top };
  }

  /**
   * Staff right edge. Widening it stretches the note field only, so a bar can
   * fill a landscape row without scaling the notation up — the alternative,
   * a taller box, runs out of screen height long before the row is full.
   */
  br(play = false): number {
    const w = play ? this.state.playPaneW : this.state.paneW;
    const h = play ? this.state.playPaneH : this.state.paneH;
    if (!this.state.compact || !w || !h) return BR_DEFAULT;
    const cap = Math.max(90, h - (play ? 24 : 30) - 8);
    const need = (w / cap) * this.vbBox(play).h - 14 + this.vbX();
    return Math.round(Math.max(BR_DEFAULT, Math.min(1100, need - 14)));
  }

  viewBox(play = false): string {
    const x = this.vbX();
    const { top, h } = this.vbBox(play);
    return `${x} ${top} ${this.br(play) + 14 - x} ${h}`;
  }

  /**
   * The note origin for a bar, matching what the renderer used. Gestures only
   * ever reach the current part, so its own ordering decides whether the bar
   * draws a time signature — and therefore where its first slot sits.
   */
  private note0(bar: Bar): number {
    const bars = this.curPart().bars;
    const i = bars.findIndex((b) => b.id === bar.id);
    return note0For(bar, i > 0 ? bars[i - 1] : null, Math.max(i, 0));
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
    const n0 = this.note0(bar);
    const sw = slotW(bar, this.br(), n0);
    let best: import('./model/types').Note | null = null;
    let bd = 1e9;
    bar.notes.forEach((n) => {
      const dx = xOf(bar, n.s, this.br(), n0) - ux;
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
      ux: x0 + ((e.clientX - r.left) * (this.br() + 14 - x0)) / r.width,
      uy: ((e.clientY - r.top) * VBH) / r.height,
    };
  }

  /**
   * Nearest grid position for a pointer x, snapped to the note value being
   * placed: quarters land on 1 2 3 4, eighths on 1 & 2 & …, sixteenths on
   * 1 e & a …. Pass `d = 16` for things that want the raw grid (loop points).
   */
  private slotAt(bar: Bar, ux: number, d: NoteValue = this.state.dur): number {
    const step = slotsFor(bar, d);
    const n0 = this.note0(bar);
    const raw = (ux - n0) / slotW(bar, this.br(), n0);
    const snapped = Math.round(raw / step) * step;
    return Math.max(0, Math.min(RES(bar) - step, snapped));
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
    if (!st.playing) this.audition(v, st.art);
  }

  mutNote(
    barId: string,
    noteId: string,
    fn: (n: import('./model/types').Note, b: Bar) => void | null,
  ): void {
    this.edit((p) => {
      const bar = this.findBar(p, barId);
      if (!bar) return;
      const i = bar.notes.findIndex((n) => n.id === noteId);
      if (i < 0) return;
      if (fn(bar.notes[i], bar) === null) bar.notes.splice(i, 1);
    });
  }

  /** Is `d` a legal value for the selected note, where it currently sits? */
  durAllowed(d: NoteValue): boolean {
    const n = this.selNote();
    if (!n || !this.state.sel) return true;
    const bar = this.findBar(this.proj(), this.state.sel.barId);
    return !bar || canPlace(bar, n.s, d);
  }

  applyDur = (d: NoteValue): void => {
    const n = this.selNote();
    if (n && this.state.sel) {
      // A quarter can't begin on an off-beat and an eighth can't begin on a
      // sixteenth — placement snaps to that, and editing the value must not be
      // a way around it.
      if (!this.durAllowed(d)) {
        this.flash(d === 4 ? '1/4 STARTS ON A BEAT' : '1/8 STARTS ON A BEAT OR &');
        return;
      }
      this.mutNote(this.state.sel.barId, n.id, (x) => void (x.d = d));
      this.setState({ dur: d, sel: null });
      return;
    }
    this.setState({ dur: d });
  };

  applyArt = (a: Articulation): void => {
    const n = this.selNote();
    if (n && this.state.sel) {
      this.mutNote(this.state.sel.barId, n.id, (x) => void (x.a = a));
      this.audition(n.v, a);
      this.setState({ art: a, sel: null });
      return;
    }
    this.setState({ art: a });
  };

  toggleRest = (): void => {
    const n = this.selNote();
    if (n && this.state.sel) {
      this.mutNote(this.state.sel.barId, n.id, (x) => void (x.rest = !x.rest));
      this.setState({ sel: null });
    } else this.flash('SELECT A NOTE');
  };

  /** A meter change applies to the tapped bar and every bar after it. */
  setSig(barId: string, n: number, dv: number): void {
    this.edit(
      (p) => {
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
      },
      n + '/' + dv,
    );
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
    this.g = {
      barId: bar.id,
      x: e.clientX,
      y: e.clientY,
      ux: q.ux,
      uy: q.uy,
      note,
      moved: false,
    };
    if (this.state.loopArm) {
      const s = this.slotAt(bar, q.ux, 16);
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
    if (!g.moved && Math.hypot(e.clientX - (g.x ?? 0), e.clientY - (g.y ?? 0)) > 7)
      g.moved = true;
    if (!g.moved || !g.note) return;
    const q = this.pt(e);
    const s = this.slotAt(bar, q.ux, g.note.d);
    const v = this.nearVoice(q.uy).id;
    const d = this.state.drag;
    if (!d || d.s !== s || d.v !== v)
      this.setState({ drag: { barId: bar.id, noteId: g.note.id, v, s } });
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
      this.setState({ drag: null, sel: null });
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
      if ((g.ux ?? 0) < this.note0(bar) - 16 || (g.uy ?? 0) < 28 || (g.uy ?? 0) > 132) {
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
      this.setState({
        sel: { barId: bar.id, noteId: g.note.id },
        dur: g.note.d,
        art: g.note.a,
      });
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

  /** A new part starts on its cymbal line only — nothing else is written for you. */
  addPart = (feel: Feel): void => {
    const p = this.proj();
    const first = p.parts[0]?.bars[0];
    const bar = feelBar(feel, first?.n ?? 4, first?.dv ?? 4);
    this.edit((pp) => {
      pp.parts.push({ id: uid(), name: 'Part ' + (pp.parts.length + 1), bars: [bar] });
    });
    this.setState({ part: p.parts.length, bar: 0, sel: null });
  };

  /** A new bar arrives with its cymbal line filled in, like a new part does. */
  addBar = (feel: Feel, at?: number): void => {
    const part = this.curPart();
    const near = part.bars[at !== undefined ? Math.max(0, at - 1) : part.bars.length - 1];
    const bar = feelBar(feel, near?.n ?? 4, near?.dv ?? 4);
    const idx = at !== undefined ? at : part.bars.length;
    this.edit((pp) => {
      pp.parts[this.state.part].bars.splice(idx, 0, bar);
    });
    this.setState({ bar: idx, sel: null });
  };

  createProject = (feel: Feel): void => {
    const np = newProj(feelBar(feel));
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
            t: 'BAR AFTER',
            ...mono,
            act: () => this.setState({ sheet: { k: 'feel', target: 'bar', at: idx + 1 } }),
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
                if (st.part > 0)
                  pp.parts.splice(st.part - 1, 0, pp.parts.splice(st.part, 1)[0]);
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

    if (S.k === 'import') {
      const text = S.text ?? '';
      return {
        title: 'ADD A SHARED SHEET',
        close,
        input: {
          val: text,
          onChange: (v: string) => this.setState({ sheet: { k: 'import', text: v } }),
        },
        items: [
          {
            g: '↓',
            t: 'ADD SHEET',
            ...mono,
            bg: this.acc,
            fg: '#0d0d10',
            min: '150px',
            act: () => {
              void this.importShared(text);
              close();
            },
          },
          {
            g: '⧉',
            t: 'PASTE',
            ...mono,
            min: '110px',
            act: () => {
              void navigator.clipboard
                .readText()
                .then((v) => this.setState({ sheet: { k: 'import', text: v } }))
                .catch(() => this.flash('CLIPBOARD BLOCKED'));
            },
          },
        ],
      };
    }

    if (S.k === 'tempo') {
      return {
        title: 'TEMPO · ' + p.bpm + ' BPM',
        close,
        input: {
          val: String(p.bpm),
          numeric: true,
          onChange: (v: string) => {
            const n = Math.round(Number(v.replace(/[^0-9]/g, '')));
            if (Number.isFinite(n) && n > 0)
              this.edit(
                (pp) => void (pp.bpm = Math.max(30, Math.min(300, n))),
                undefined,
                'bpm',
              );
          },
        },
        items: [
          {
            g: '●',
            t: 'TAP TEMPO',
            ...mono,
            fs: '15px',
            bg: this.acc,
            fg: '#0d0d10',
            min: '100%',
            act: () => this.tapTempo(),
          },
          {
            g: '−',
            t: '5 SLOWER',
            ...mono,
            act: () =>
              this.edit((pp) => void (pp.bpm = Math.max(30, pp.bpm - 5)), undefined, 'bpm'),
          },
          {
            g: '+',
            t: '5 FASTER',
            ...mono,
            act: () =>
              this.edit((pp) => void (pp.bpm = Math.min(300, pp.bpm + 5)), undefined, 'bpm'),
          },
        ],
      };
    }

    if (S.k === 'feel') {
      return {
        title:
          S.target === 'part'
            ? 'NEW PART · FEEL'
            : S.target === 'bar'
              ? 'NEW BAR · FEEL'
              : 'NEW SHEET · FEEL',
        close,
        items: FEELS.map((f) => ({
          g: f.glyph,
          t: f.label,
          fs: '30px',
          dy: '6px',
          min: '150px',
          act: () => {
            if (S.target === 'part') this.addPart(f);
            else if (S.target === 'bar') this.addBar(f, S.at);
            else this.createProject(f);
            close();
          },
        })),
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
        ...FEELS.map((f) => ({
          g: f.glyph,
          t: f.label,
          fs: '26px',
          dy: '5px',
          min: '108px',
          act: () => {
            this.addBar(f);
            close();
          },
        })),
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
        className="app-root"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          // padding-top comes from --band in styles.css
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
