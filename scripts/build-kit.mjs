/**
 * Builds the bundled sound pack from the Versilian Community Sample Library.
 *
 * VCSL is CC0-1.0 — public domain, no attribution required and nothing to
 * comply with when redistributing — which is why it is the source. It is also
 * real recorded percussion with velocity layers and round robins, so the pack
 * has dynamics and does not machine-gun on repeated hits.
 *
 * Run by hand, not from `npm run build`: it needs network, ffmpeg and sox, and
 * its output is committed. `node scripts/build-kit.mjs`
 *
 * What it does per slot:
 *   1. fetch the source WAVs (cached in the scratch dir between runs)
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
const RAW = 'https://raw.githubusercontent.com/sgossner/VCSL/master/';

const IDIO = 'Idiophones/Struck Idiophones/';
const MEMB = 'Membranophones/Struck Membranophones/';

/**
 * `bands` run quietest to loudest; the files inside one band are round robins
 * of the same stroke. `sec` is the hard length cap, `rate` the output sample
 * rate — 32k keeps cymbal sizzle, 22k is plenty for a kick and half the bytes.
 */
const SLOTS = {
  kick: {
    sec: 0.5,
    rate: 22050,
    src: MEMB + 'Bass Drum 1/',
    bands: [['BDrumNew_hit_v2_rr1_Sum.wav'], ['BDrumNew_hit_v3_rr1_Sum.wav'], ['BDrumNew_hit_v5_rr1_Sum.wav']],
  },
  /*
   * Modern 3 rather than Modern 1, which was the first choice: it is the only
   * snare in the library with a rim shot and a cross-stick alongside its plain
   * hits, so every articulation comes off the same drum. A rim shot recorded
   * on a different snare than the notes around it is immediately obvious.
   */
  snare: {
    sec: 0.42,
    rate: 32000,
    src: MEMB + 'Snare Drum, Modern 3/',
    bands: [
      ['Snare4_HitSN_v2_rr1_Mid.wav', 'Snare4_HitSN_v2_rr2_Mid.wav'],
      ['Snare4_HitSN_v4_rr1_Mid.wav', 'Snare4_HitSN_v4_rr2_Mid.wav'],
      ['Snare4_HitSN_v5_rr1_Mid.wav', 'Snare4_HitSN_v5_rr2_Mid.wav'],
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
    src: IDIO + 'Hi-Hat Cymbal/',
    bands: [
      ['HiHat_HitC_v2_rr1_Mid.wav', 'HiHat_HitC_v2_rr2_Mid.wav'],
      ['HiHat_HitC_v3_rr1_Mid.wav', 'HiHat_HitC_v3_rr2_Mid.wav'],
      ['HiHat_HitC_v4_rr1_Mid.wav', 'HiHat_HitC_v4_rr2_Mid.wav'],
    ],
  },
  // One band, two round robins: an open hat is one sound, but repeated ones
  // machine-gun badly without an alternate take.
  'hihat.open': {
    sec: 0.85,
    rate: 32000,
    src: IDIO + 'Hi-Hat Cymbal/',
    bands: [['HiHat_HitO_rr1_Mid.wav', 'HiHat_HitO_rr2_Mid.wav']],
  },
  // Half-open: the loose stroke, shorter and dirtier than a full open hat.
  'hihat.half': {
    sec: 0.42,
    rate: 32000,
    src: IDIO + 'Hi-Hat Cymbal/',
    bands: [['HiHat_HitLoose_rr1_Mid.wav', 'HiHat_HitLoose_rr2_Mid.wav']],
  },
  // The pedal "chick" — foot closing the hats, with no stick involved. Its own
  // voice on the staff, below the kick, so it can sound under a hand stroke.
  hhfoot: {
    sec: 0.3,
    rate: 32000,
    src: IDIO + 'Hi-Hat Cymbal/',
    bands: [['HiHat_Close_rr1_Mid.wav', 'HiHat_Close_rr2_Mid.wav']],
  },
  /*
   * The cymbals, third attempt, and this time from what the recordings
   * actually are rather than from what they are called.
   *
   * Clash Cymbals are the orchestral pair struck together in two hands. They
   * are a crash in the concert sense and nothing like the one bolted to a kit,
   * which is a suspended cymbal hit hard with a stick — so those are gone.
   *
   * `hit_f`/`hit_fff` are not strikes either: their peak arrives 113-572ms
   * after the sound starts, which is a mallet swell, not a stick. Only the
   * `hit_stick_` files have a real attack (1-2ms).
   *
   * That leaves one usable stick set. Suspended Cymbal 2's is not it — its
   * loudest layer measures duller and slower-attacked than its middle one, so
   * hitting harder would have sounded softer. Cymbal 1's runs 3579 → 4207 →
   * 4277Hz across pp/mp/f at a uniform 1-2ms, which is a well-behaved velocity
   * set, and it is the only one.
   *
   * So both cymbals are that recording at different tape speeds — which is
   * also the truth of it, since pitch is most of what separates a ride from a
   * crash. Up for the ride: brighter and shorter, a defined tap. Down for the
   * crash: bigger, longer, more wash. The bell keeps Cymbal 2's, the brighter
   * of the two bells, lifted so it pings above the ride rather than under it.
   */
  ride: {
    sec: 0.95,
    rate: 32000,
    speed: 1.22,
    src: IDIO + 'Suspended Cymbal 1/',
    bands: [
      ['susCymb1_hit_stick_pp1.wav'],
      ['susCymb1_hit_stick_mp1.wav'],
      ['susCymb1_hit_stick_f1.wav'],
    ],
  },
  'ride.bell': {
    sec: 1.2,
    rate: 32000,
    speed: 1.15,
    src: IDIO + 'Suspended Cymbal 2/',
    bands: [['susCymb2_hit_bell_p1.wav'], ['susCymb2_hit_bell_f1.wav']],
  },
  // Crashing the ride: the same cymbal at the same pitch as the ride, hit
  // hard and left to ring instead of being cut off after a tap.
  'ride.crash': {
    sec: 2.2,
    rate: 32000,
    speed: 1.22,
    src: IDIO + 'Suspended Cymbal 1/',
    bands: [['susCymb1_hit_stick_mp1.wav'], ['susCymb1_hit_stick_f1.wav']],
  },
  // The kit crash: a bigger, lower cymbal, hit hard and left to wash out.
  crash: {
    sec: 2.8,
    rate: 32000,
    speed: 0.88,
    src: IDIO + 'Suspended Cymbal 1/',
    bands: [['susCymb1_hit_stick_mp1.wav'], ['susCymb1_hit_stick_f1.wav']],
  },
  'tom.hi': {
    sec: 0.6,
    rate: 22050,
    src: MEMB + 'Tom 1/Stick/',
    bands: [
      ['TomH_HitS_v2_rr1_Mid.wav'],
      ['TomH_HitS_v3_rr1_Mid.wav'],
      ['TomH_HitS_v4_rr1_Mid.wav'],
    ],
  },
  'tom.low': {
    sec: 0.7,
    rate: 22050,
    src: MEMB + 'Tom 2/Stick/',
    bands: [
      ['TomL_HitS_v2_rr1_Mid.wav'],
      ['TomL_HitS_v3_rr1_Mid.wav'],
      ['TomL_HitS_v4_rr1_Mid.wav'],
    ],
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
      for (const name of band) {
        const src = await fetchSrc(spec.src + name);
        const tmp = join(WORK, 'cond', `${slot}-${name}`.replace(/[^A-Za-z0-9._-]/g, '_') + '.wav');
        sh('sox', [
          src,
          '-c', '1',
          '-r', String(spec.rate),
          '-b', '16',
          tmp,
          // Tape-speed shift: resamples, so pitch and length move together —
          // which is what separates a ride from a crash struck off the same
          // recording. Up is brighter and shorter, down bigger and longer.
          ...(spec.speed ? ['speed', String(spec.speed)] : []),
          // leading silence first, so the length cap measures from the attack
          'silence', '1', '0.001', '-55d',
          'trim', '0', String(spec.sec),
          // 40ms out, or cutting a ringing cymbal mid-cycle clicks
          'fade', '0', String(spec.sec), '0.04',
        ]);
        row.push({ tmp, name });
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
