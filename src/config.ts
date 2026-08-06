/** Tweakable props surfaced by the design. */
export const ACCENT = 'oklch(0.8 0.14 72)';
export const SHOW_BEAT_NUMBERS = true;

/**
 * Bottom safe-area padding. Scaled rather than added to a fixed value: the
 * inset is already ~34px on an iPhone, so `calc(env(...) + 10px)` double-counts,
 * while subtracting a constant would crush a smaller Android gesture-bar inset
 * to nothing.
 */
export const SAFE_BOTTOM = 'max(calc(env(safe-area-inset-bottom) * 0.6), 8px)';

/** Accent wash — the same hue at 16% alpha, used for active toggles and the playhead. */
export const softAccent = (acc: string): string =>
  acc.startsWith('oklch') ? acc.replace(')', ' / 0.16)') : acc;
