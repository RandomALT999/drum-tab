/**
 * How far down the page iOS keeps frosting, past the band it draws.
 *
 * There is no way to read this from script: the effect is composited by the
 * system over the web view, so the page cannot see its own blurred pixels. It
 * has to be measured by eye, which is what the band ruler in the diagnostics
 * panel is for — this is where the number it produces lives.
 */
const KEY = 'drumtab.fade.v1';

/**
 * Until the ruler has been used. Measured on an iPhone 16 Pro, iOS 27: the
 * stripes came back sharp at 84px against a 62px band. Every pixel of this is
 * screen given up, so it is a measurement, not a margin of safety.
 */
export const DEFAULT_FADE = 22;

/** Past this the clearance costs more screen than the blur ever did. */
export const MAX_FADE = 160;

export function readFade(): number {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return DEFAULT_FADE;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_FADE, Math.round(n))) : DEFAULT_FADE;
  } catch {
    return DEFAULT_FADE;
  }
}

export function writeFade(px: number | null): void {
  try {
    if (px === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(Math.max(0, Math.min(MAX_FADE, Math.round(px)))));
  } catch {
    /* private mode — the session keeps whatever is already on :root */
  }
}

/**
 * Extra height the app takes past the bottom of its own viewport.
 *
 * `apple-mobile-web-app-status-bar-style: black-translucent` draws the page
 * from y=0 across the whole screen but can leave the layout viewport short by
 * the height of the band, which strands a strip along the bottom that no
 * percentage height reaches. Whether that strip is painted at all is not
 * something script can ask, so — like the fade — it is measured on the glass
 * and stored here. 0 means the viewport already reaches the screen.
 */
const EXTRA_KEY = 'drumtab.vhextra.v1';

/** Nothing iOS holds back is bigger than a status bar. */
export const MAX_EXTRA = 200;

/**
 * Measured on an iPhone 16 Pro, iOS 27: of the 62px iOS held back, 54 were
 * being drawn — the last few vanish into the corner radius. Always clamped to
 * what the device reports as held back, so a smaller band cannot overshoot.
 */
export const DEFAULT_EXTRA = 54;

export function readExtra(): number {
  try {
    const v = localStorage.getItem(EXTRA_KEY);
    if (v === null) return DEFAULT_EXTRA;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_EXTRA, Math.round(n))) : DEFAULT_EXTRA;
  } catch {
    return DEFAULT_EXTRA;
  }
}

export function writeExtra(px: number): void {
  try {
    localStorage.setItem(EXTRA_KEY, String(Math.max(0, Math.min(MAX_EXTRA, Math.round(px)))));
  } catch {
    /* private mode — the session keeps whatever is already on :root */
  }
}
