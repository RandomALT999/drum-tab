/**
 * Builds the bundled sound pack from two sources.
 *
 * The kit itself — kick, snare, hi-hat, ride (+ bell), crash, and all three
 * toms — comes from MuldjordKit: a real Tama Superstar rock/metal kit
 * recorded by Lars Muldjord for the DrumGizmo project, CC-BY 4.0 (credit
 * Lars Muldjord and the DrumGizmo team if this pack is ever redistributed
 * publicly). Real velocity layers, real round robins, an actual ride and an
 * actual crash — not a suspended concert cymbal standing in for one.
 *
 * A few articulations MuldjordKit was never recorded with — the snare rim
 * shot, the snare cross-stick, the half-open hi-hat, and the hi-hat pedal
 * chick — still come from the Versilian Community Sample Library (VCSL,
 * CC0), same as before. Mixing sources for a snare's own rim shot and
 * cross-stick means those two articulations are a different physical snare
 * than the plain hit sitting next to them on the staff — audible if you
 * listen for it, but the alternative was silence, which is worse.
 *
 * Run by hand, not from `npm run build`: it needs network, ffmpeg and sox, and
 * its output is committed. `node scripts/build-kit.mjs`
 *
 * What it does per slot:
 *   1. fetch the source WAV/FLACs (cached in the scratch dir between runs)
 *   2. trim the leading silence, cap the length, fade the cut, mono, resample
 *   3. peak-normalise the whole slot by ONE factor — per-file normalising would
 *      flatten the very velocity differences the layers exist to carry
 *   4. encode mono MP3
 *
 * MP3 because the alternative is ~4x the bytes: the pack is precached by the
 * service worker, so it is a download every installed copy pays for. Decoders
 * pad the start of an MP3 by up to ~1100 samples, which on a drum hit is
 * audible slop, so the runtime finds each buffer's real onset after decoding
 * and starts playback there.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'kit');
const WORK = join(
  process.env.LOCALAPPDATA || process.env.TMPDIR || '/tmp',
  'Temp',
  'drumtab-kit',
);
const RAW = 'https://raw.githubusercontent.com/';

const VCSL = 'sgossner/VCSL/master/';
const IDIO = VCSL + 'Idiophones/Struck Idiophones/';
const MEMB = VCSL + 'Membranophones/Struck Membranophones/';

// MuldjordKit lives at DrumGizmo/MuldjordKit/Samples/<piece>/ inside its repo,
// one FLAC per mic channel per recorded hit: `<hit>-<piece>-<mic>.flac`. Hit
// numbers run soft to loud within a piece (confirmed against the kit's own
// SFZ region files, which group them into named velocity bands in that
// order) — so a low, middle and high hit number really is a soft/medium/loud
// triad, not a guess from file order.
const MULD = 'sfzinstruments/DrumGizmo.MuldjordKit/master/DrumGizmo/MuldjordKit/Samples/';

/**
 * `bands` run quietest to loudest; the files inside one band are round robins
 * of the same stroke. `sec` is the hard length cap, `rate` the output sample
 * rate — 32k keeps cymbal sizzle, 22k is plenty for a kick and half the bytes.
 *
 * A band item is normally a filename, fetched and conditioned as one file.
 * Where MuldjordKit has no dedicated close mic on a piece — true of both
 * crashes — a band item can instead be `{ mix: [fileA, fileB] }`: two files
 * fetched and summed to mono (each at half gain, so two full-scale mics
 * cannot clip when added) before the usual trim/fade/normalise chain. The
 * overheads are the closest thing a crash has to its own mic here.
 */
const SLOTS = {
  kick: {
    sec: 0.5,
    rate: 22050,
    src: MULD + 'KdrumR/',
    bands: [['1-KdrumR-KdrumR.flac'], ['4-KdrumR-KdrumR.flac'], ['20-KdrumR-KdrumR.flac']],
  },
  /*
   * MuldjordKit's own snare, but its rim shot and cross-stick below are still
   * VCSL's Snare Drum Modern 3 — MuldjordKit was never recorded with either
   * articulation, and no articulation at all is worse than one from a
   * different snare. If that mismatch bothers the ear, the fix is recording
   * (or finding) a rim shot and cross-stick on this actual kit, not a build
   * script change.
   */
  snare: {
    sec: 0.42,
    rate: 32000,
    src: MULD + 'Snare/',
    bands: [
      ['1-Snare-Snare_top.flac'],
      ['20-Snare-Snare_top.flac'],
      ['50-Snare-Snare_top.flac'],
    ],
  },
  'snare.rim': {
    sec: 0.36,
    rate: 32000,
    src: MEMB + 'Snare Drum, Modern 3/',
    bands: [
      ['Snare4_rimshot_v2_rr1_Mid.wav', 'Snare4_rimshot_v2_rr2_Mid.wav'],
      ['Snare4_rimshot_v4_rr1_Mid.wav', 'Snare4_rimshot_v4_rr2_Mid.wav'],
    ],
  },
  // Cross-stick — the quiet one, stick laid across the head onto the rim.
  'snare.xstick': {
    sec: 0.3,
    rate: 32000,
    src: MEMB + 'Snare Drum, Modern 3/',
    bands: [['Snare4_Xstick_v2_rr1_Mid.wav', 'Snare4_Xstick_v2_rr2_Mid.wav']],
  },
  hihat: {
    sec: 0.19,
    rate: 32000,
    src: MULD + 'HihatClosed/',
    bands: [
      ['1-HihatClosed-Hihat.flac'],
      ['11-HihatClosed-Hihat.flac'],
      ['20-HihatClosed-Hihat.flac'],
    ],
  },
  'hihat.open': {
    sec: 0.85,
    rate: 32000,
    src: MULD + 'HihatOpen/',
    bands: [['2-HihatOpen-Hihat.flac'], ['8-HihatOpen-Hihat.flac'], ['15-HihatOpen-Hihat.flac']],
  },
  // Half-open: MuldjordKit only has fully closed and fully open, so this one
  // — like the hi-hat foot below — still comes from VCSL's hi-hat.
  'hihat.half': {
    sec: 0.42,
    rate: 32000,
    src: IDIO + 'Hi-Hat Cymbal/',
    bands: [['HiHat_HitLoose_rr1_Mid.wav', 'HiHat_HitLoose_rr2_Mid.wav']],
  },
  // The pedal "chick" — foot closing the hats, with no stick involved. Its own
  // voice on the staff, below the kick, so it can sound under a hand stroke.
  // Not in MuldjordKit either, so this is VCSL too.
  hhfoot: {
    sec: 0.3,
    rate: 32000,
    src: IDIO + 'Hi-Hat Cymbal/',
    bands: [['HiHat_Close_rr1_Mid.wav', 'HiHat_Close_rr2_Mid.wav']],
  },
  /*
   * The kit has two real rides and two real crashes. Only one of each fits
   * the app's single ride/crash voices, so the right-side ride and the
   * right-side crash were picked — the left ones are unused, not missing;
   * the raw library still has them if a future pass wants a different pair.
   */
  ride: {
    sec: 1.5,
    rate: 32000,
    src: MULD + 'RideR/',
    bands: [['1-RideR-RideR.flac'], ['5-RideR-RideR.flac'], ['7-RideR-RideR.flac']],
  },
  // Same mic, same physical cymbal as `ride` — unlike the old VCSL pack,
  // where the bell had to be borrowed from an unrelated instrument, this
  // bell actually belongs to the ride it sits next to. See FAMILY in pack.ts:
  // that shared session is what lets the bell's level be read from its own
  // recorded peak instead of a hand-set number.
  'ride.bell': {
    sec: 1.2,
    rate: 32000,
    src: MULD + 'RideRBell/',
    bands: [['1-RideRBell-RideR.flac'], ['5-RideRBell-RideR.flac'], ['7-RideRBell-RideR.flac']],
  },
  /*
   * Crashing the ride: literally the ride's own loudest recorded hits again,
   * just given more room to ring (2.5s instead of 1.5s) instead of being cut
   * short. The old VCSL pack had to fake this with a pitch/tempo trick because
   * its only cymbal recording didn't have a genuinely harder hit to reach for;
   * this one does, so the trick is gone and TRIM['ride.crash'] in pack.ts goes
   * with it — the family ratio alone is now the correct model, because this
   * really is the same performance the plain ride reaches for at max velocity.
   */
  'ride.crash': {
    sec: 2.5,
    rate: 32000,
    src: MULD + 'RideR/',
    bands: [['7-RideR-RideR.flac'], ['9-RideR-RideR.flac']],
  },
  // The kit crash: MuldjordKit close-mics every drum and the hi-hat and both
  // rides, but not the crashes — only the stereo overheads catch them, so
  // that's what's mixed down to mono here.
  crash: {
    sec: 2.8,
    rate: 32000,
    src: MULD + 'CrashR/',
    bands: [
      [{ mix: ['6-CrashR-OHL.flac', '6-CrashR-OHR.flac'] }],
      [{ mix: ['9-CrashR-OHL.flac', '9-CrashR-OHR.flac'] }],
    ],
  },
  'tom.hi': {
    sec: 0.6,
    rate: 22050,
    src: MULD + 'Tom1/',
    bands: [['1-Tom1-Tom1.flac'], ['5-Tom1-Tom1.flac'], ['7-Tom1-Tom1.flac']],
  },
  /*
   * MuldjordKit has three hanging toms, not two — so unlike the old VCSL
   * pack, the mid tom no longer has to be the high tom pitched down and
   * faked. This is Tom1/Tom2/Tom4's own middle drum, genuinely recorded.
   * Tom3 (a fourth, extra rack tom) goes unused: the app only has three tom
   * voices to fill. See VOICE.midtom in pack.ts — it points here now, gain
   * only, no `rate` retune.
   */
  'tom.mid': {
    sec: 0.65,
    rate: 22050,
    src: MULD + 'Tom2/',
    bands: [['1-Tom2-Tom2.flac'], ['5-Tom2-Tom2.flac'], ['8-Tom2-Tom2.flac']],
  },
  'tom.low': {
    sec: 0.7,
    rate: 22050,
    src: MULD + 'Tom4/',
    bands: [['1-Tom4-Tom4.flac'], ['6-Tom4-Tom4.flac'], ['9-Tom4-Tom4.flac']],
  },
};

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function fetchSrc(path) {
  const cache = join(WORK, 'src', path.replace(/[^A-Za-z0-9._-]/g, '_'));
  if (existsSync(cache)) return cache;
  mkdirSync(dirname(cache), { recursive: true });
  const url = RAW + path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(cache, Buffer.from(await r.arrayBuffer()));
  return cache;
}

/** A band item is a filename, or `{ mix: [fileA, fileB] }` for a piece with no
 * dedicated close mic — see the SLOTS doc comment above. Returns a label
 * (for temp-file naming) and the fetched-and-possibly-mixed source path. */
async function resolveItem(src, item) {
  if (typeof item === 'string') {
    return { label: item, path: await fetchSrc(src + item) };
  }
  const [a, b] = item.mix;
  const pathA = await fetchSrc(src + a);
  const pathB = await fetchSrc(src + b);
  const label = item.mix.join('+');
  const tmp = join(WORK, 'src', 'mix-' + label.replace(/[^A-Za-z0-9._-]/g, '_') + '.wav');
  if (!existsSync(tmp)) {
    // Half gain on each side before summing: two full-scale mics added at
    // full gain would clip, and clipping baked in here survives the
    // peak-normalising step downstream — that only scales, it cannot un-clip.
    sh('sox', ['-m', '-v', '0.5', pathA, '-v', '0.5', pathB, tmp]);
  }
  return { label, path: tmp };
}

/**
 * Peak as a 0..1 amplitude. `sox -n stat` writes to stderr and exits 0, so it
 * has to be read from a captured stream rather than caught as a failure — the
 * first version of this looked for the number in an exception that never
 * arrived and quietly reported 1.0 for every slot, which is no normalising at
 * all. Throwing beats defaulting: a silent 1.0 is indistinguishable from a
 * correctly measured full-scale file.
 */
function peak(file) {
  const r = spawnSync('sox', [file, '-n', 'stat'], { encoding: 'utf8' });
  const m = String(r.stderr || '').match(/Maximum amplitude:\s+([\d.eE+-]+)/);
  if (!m) throw new Error('no peak from sox for ' + file + '\n' + r.stderr);
  return Math.abs(Number(m[1]));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(WORK, 'cond'), { recursive: true });
  const manifest = {};
  let bytes = 0;
  let seconds = 0;

  for (const [slot, spec] of Object.entries(SLOTS)) {
    const conditioned = [];
    for (const band of spec.bands) {
      const row = [];
      for (const item of band) {
        const { label, path: src } = await resolveItem(spec.src, item);
        const tmp = join(WORK, 'cond', `${slot}-${label}`.replace(/[^A-Za-z0-9._-]/g, '_') + '.wav');
        sh('sox', [
          src,
          '-c', '1',
          '-r', String(spec.rate),
          '-b', '16',
          tmp,
          // Tape-speed shift: resamples, so pitch and length move together —
          // used where a slot has to reach a pitch its own recording isn't at.
          ...(spec.speed ? ['speed', String(spec.speed)] : []),
          // leading silence first, so the length cap measures from the attack
          'silence', '1', '0.001', '-55d',
          'trim', '0', String(spec.sec),
          // 40ms out, or cutting a ringing cymbal mid-cycle clicks
          'fade', '0', String(spec.sec), '0.04',
        ]);
        row.push({ tmp, name: label });
      }
      conditioned.push(row);
    }

    // One gain for the whole slot: normalising each file on its own would erase
    // the loudness difference that makes the layers worth having.
    const hottest = Math.max(...conditioned.flat().map((f) => peak(f.tmp)));
    const gainDb = -1.5 - 20 * Math.log10(hottest || 1);

    const bands = [];
    for (let b = 0; b < conditioned.length; b++) {
      const files = [];
      for (let r = 0; r < conditioned[b].length; r++) {
        const stem = `${slot.replace('.', '-')}-${b}${conditioned[b].length > 1 ? String.fromCharCode(97 + r) : ''}`;
        const wav = join(WORK, 'cond', stem + '.norm.wav');
        const mp3 = join(OUT, stem + '.mp3');
        sh('sox', [conditioned[b][r].tmp, wav, 'gain', gainDb.toFixed(2)]);
        sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', mp3]);
        bytes += readFileSync(mp3).length;
        seconds += spec.sec;
        files.push(stem + '.mp3');
      }
      bands.push(files);
    }
    // The pre-normalising peak goes in the manifest because normalising throws
    // away exactly the information needed to balance articulations of one
    // instrument against each other. A cross-stick is 13dB under a plain snare
    // hit as recorded; brought to the same ceiling and played at the same gain
    // it would be as loud as a full stroke, which is nonsense. Peaks are only
    // comparable inside one instrument — same session, same mics — so the
    // runtime uses the ratio within a family and nothing across families.
    manifest[slot] = { peak: Number(hottest.toFixed(4)), bands };
    console.log(`${slot.padEnd(12)} ${bands.flat().length} files  peak ${hottest.toFixed(3)}  gain ${gainDb.toFixed(1)}dB`);
  }

  const files = Object.values(manifest).flatMap((s) => s.bands.flat()).length;
  console.log(`\n${files} files, ${(bytes / 1024).toFixed(0)}KB, ${seconds.toFixed(1)}s of audio`);
  writeFileSync(join(OUT, 'pack.json'), JSON.stringify({ slots: manifest }, null, 2) + '\n');
}

await main();
