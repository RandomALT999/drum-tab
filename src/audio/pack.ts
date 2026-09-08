import type { Dynamic, Tech, VoiceId } from '../model/types';

/** Where the built pack is served from, under the app's base URL. */
export const PACK_DIR = 'kit/';

/**
 * Which slot of the pack each voice plays, which slots its techniques reach
 * for, and how loud the drum sits.
 *
 * No `rate` retune anywhere here any more: the old VCSL pack only had a high
 * and a low concert tom, so the mid tom had to be the high tom dropped a
 * little and stand in for a drum it wasn't. MuldjordKit was recorded with
 * three hanging toms, so `midtom` now points at its own slot instead.
 */
export const VOICE: Record<
  VoiceId,
  { slot: string; gain: number; rate?: number; tech?: Partial<Record<Tech, string>> }
> = {
  kick: { slot: 'kick', gain: 1 },
  snare: {
    slot: 'snare',
    gain: 0.82,
    tech: { rim: 'snare.rim', xstick: 'snare.xstick' },
  },
  hihat: {
    slot: 'hihat',
    gain: 0.42,
    tech: { open: 'hihat.open', half: 'hihat.half' },
  },
  ride: {
    slot: 'ride',
    gain: 0.34,
    tech: { bell: 'ride.bell', crash: 'ride.crash' },
  },
  crash: { slot: 'crash', gain: 0.45 },
  hitom: { slot: 'tom.hi', gain: 0.78 },
  midtom: { slot: 'tom.mid', gain: 0.8 },
  floor: { slot: 'tom.low', gain: 0.82 },
  // The pedal chick is a hi-hat sound and is balanced against the hats below,
  // which is where its ten decibels of restraint come from.
  hhfoot: { slot: 'hhfoot', gain: 0.42 },
};

/**
 * Whose recorded level each slot should be judged against.
 *
 * Every slot is peak-normalised on its own, which is what stops one quiet
 * recording being inaudible — and also throws away the difference between a
 * rim shot and a cross-stick, which is most of what distinguishes them. The
 * manifest keeps each slot's pre-normalising peak, so the ratio between two
 * slots recorded in the same session restores the balance the room had:
 * cross-stick lands 13dB under a plain snare hit, the bell 4dB over a ride
 * tap, the pedal chick 10dB under a stick on the hats.
 *
 * Only within a family. Across instruments the peaks say nothing — different
 * session, different mics, different gain — so those are the hand-set numbers
 * above.
 */
/**
 * Level a slot's recorded peak cannot speak for.
 *
 * Empty for now. The old VCSL pack needed two entries here: `ride.crash` was
 * the ride's own recording at a different tape speed, so its peak and the
 * ride's peak were identical and said "equally loud" when crashing it should
 * read louder; `ride.bell` came off an unrelated cymbal with no shared
 * session to read a ratio from at all. MuldjordKit's ride, bell and "crashed"
 * ride are now genuinely the same performances they claim to be — real
 * harder hits on the real cymbal they belong to — so the family ratio in
 * FAMILY below is the correct number on its own. Left in place, empty,
 * because the next slot that borrows a recording from somewhere it doesn't
 * belong will need it again.
 */
export const TRIM: Record<string, number> = {};

export const FAMILY: Record<string, string> = {
  'snare.rim': 'snare',
  'snare.xstick': 'snare',
  'hihat.open': 'hihat',
  'hihat.half': 'hihat',
  hhfoot: 'hihat',
  'ride.crash': 'ride',
  // Now the same mic on the same cymbal as `ride`, unlike the old pack's
  // borrowed bell — so this reads a real ratio too. See TRIM above.
  'ride.bell': 'ride',
};

/**
 * Which velocity layer a dynamic reaches for. Ghost takes the softest recorded
 * stroke and accent the hardest, so the difference is a different performance
 * rather than the same one turned up — which is the whole reason for shipping
 * layers instead of one sample per drum.
 */
export function bandFor(bands: number, d: Dynamic): number {
  if (bands <= 1) return 0;
  if (d === 'ghost') return 0;
  if (d === 'accent') return bands - 1;
  return Math.floor((bands - 1) / 2);
}

/**
 * Trim on top of the layer, and it depends on whether there was a layer to
 * choose. With several, the recording already carries the dynamic and ghost
 * only needs a lift because an orchestral library's softest stroke is up to
 * 20dB down — quieter than a ghost note should be on a phone speaker. With
 * one, nothing is carrying it, so the gain has to do the whole job: a
 * cross-stick has a single take, and boosting a ghost there would have made
 * the quiet stroke the loud one.
 */
export function gainFor(bands: number, d: Dynamic): number {
  if (bands > 1) return d === 'ghost' ? 1.6 : 1;
  return d === 'ghost' ? 0.45 : d === 'accent' ? 1.25 : 1;
}
