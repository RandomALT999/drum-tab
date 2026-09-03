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
