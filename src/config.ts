/** Tweakable props surfaced by the design. */
export const ACCENT = 'oklch(0.8 0.14 72)';
export const SHOW_BEAT_NUMBERS = true;
export const ROTATE_TO_PLAY = true;

/** Accent wash — the same hue at 16% alpha, used for active toggles and the playhead. */
export const softAccent = (acc: string): string =>
  acc.startsWith('oklch') ? acc.replace(')', ' / 0.16)') : acc;
