import type { Articulation, VoiceId } from '../model/types';

/** Where the built pack is served from, under the app's base URL. */
export const PACK_DIR = 'kit/';

/**
 * Which slot of the pack each voice plays, and how loud it sits.
 *
 * Every slot is peak-normalised to the same ceiling at its loudest layer, so
 * these gains are the whole mix — a cymbal normalised to the same peak as a
 * kick is far too loud beside it. The starting values carry over the balance
 * the synthesised kit had, since that is the one already been listened to.
 *
 * `rate` retunes a shared slot: the pack has a high and a low concert tom, and
 * the middle one is the high tom dropped a little, which is what a third drum
 * of an intermediate size sounds like anyway.
 */
export const VOICE: Record<
  VoiceId,
  { slot: string; open?: string; gain: number; rate?: number }
> = {
  kick: { slot: 'kick', gain: 1 },
  snare: { slot: 'snare', gain: 0.82 },
  hihat: { slot: 'hihat', open: 'hihat.open', gain: 0.42 },
  ride: { slot: 'ride', open: 'ride.bell', gain: 0.34 },
  crash: { slot: 'crash', gain: 0.45 },
  hitom: { slot: 'tom.hi', gain: 0.78 },
  midtom: { slot: 'tom.hi', gain: 0.8, rate: 0.84 },
  floor: { slot: 'tom.low', gain: 0.82 },
};

/**
 * Which velocity layer an articulation reaches for. Ghost takes the softest
 * recorded stroke and accent the hardest, so the difference is a different
 * performance rather than the same one turned up — which is the entire reason
 * for shipping layers instead of one sample per drum.
 */
export function bandFor(bands: number, a: Articulation): number {
  if (bands <= 1) return 0;
  if (a === 'ghost') return 0;
  if (a === 'accent') return bands - 1;
  return Math.floor((bands - 1) / 2);
}

/**
 * Trim on top of the layer. Deliberately close to 1: the layers already carry
 * the dynamics. Ghost gets a lift because the softest stroke of an orchestral
 * recording is up to 20dB down, which is quieter than a ghost note should be
 * next to a kick on a phone speaker.
 */
export function gainFor(a: Articulation): number {
  return a === 'ghost' ? 1.6 : 1;
}
