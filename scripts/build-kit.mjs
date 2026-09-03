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
  // v3 came out 27dB under v9 — real, but the quiet end was inaudible against
  // the rest of the kit. v5/v7/v9 keeps the dynamics without the dead band.
  snare: {
    sec: 0.42,
    rate: 32000,
    src: MEMB + 'Snare Drum, Modern 1/',
    bands: [
      ['Snare2_HitSN_v5_rr1_Mid.wav', 'Snare2_HitSN_v5_rr2_Mid.wav'],
      ['Snare2_HitSN_v7_rr1_Mid.wav', 'Snare2_HitSN_v7_rr2_Mid.wav'],
      ['Snare2_HitSN_v9_rr1_Mid.wav', 'Snare2_HitSN_v9_rr2_Mid.wav'],
    ],
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
  ride: {
    sec: 1.1,
    rate: 32000,
    src: IDIO + 'Suspended Cymbal 1/',
    bands: [['susCymb1_hit_stick_pp1.wav'], ['susCymb1_hit_stick_mp1.wav'], ['susCymb1_hit_stick_f1.wav']],
  },
  'ride.bell': {
    sec: 1.3,
    rate: 32000,
    src: IDIO + 'Suspended Cymbal 1/',
    bands: [['susCymb1_hit_bell_mf1.wav']],
  },
  crash: {
    sec: 2.4,
    rate: 32000,
    src: IDIO + 'Suspended Cymbal 2/',
    bands: [['susCymb2_hit_stick_mp1.wav'], ['susCymb2_hit_stick_mf1.wav']],
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
    manifest[slot] = bands;
    console.log(`${slot.padEnd(12)} ${bands.flat().length} files  peak ${hottest.toFixed(3)}  gain ${gainDb.toFixed(1)}dB`);
  }

  console.log(`\n${Object.values(manifest).flat(2).length} files, ${(bytes / 1024).toFixed(0)}KB, ${seconds.toFixed(1)}s of audio`);
  writeFileSync(join(OUT, 'pack.json'), JSON.stringify(manifest, null, 2) + '\n');
}

await main();
