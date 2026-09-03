# Sound pack — `public/kit/`

Built from the **Versilian Community Sample Library (VCSL)** by Versilian
Studios, <https://github.com/sgossner/VCSL>, released under
**CC0 1.0 Universal** — public domain. Nothing is owed for redistributing it,
which is why it was chosen over the better-known free drum libraries: most are
CC-BY-SA or "royalty free for music production", and neither survives being
bundled into a public repo without conditions attached.

The instruments are concert percussion rather than a close-miked rock kit — a
concert snare and toms, a hi-hat, and suspended cymbals standing in for ride
and crash. That suits a notation tool: the strokes are clean and unprocessed,
so what you hear is the rhythm rather than a producer's mix.

Sources per slot:

| slot | VCSL instrument |
|---|---|
| `kick` | Bass Drum 1 — `BDrumNew_hit_v2/v3/v5` |
| `snare` | Snare Drum, Modern 3 — `Snare4_HitSN_v2/v4/v5`, both round robins |
| `snare.rim` | Snare Drum, Modern 3 — `Snare4_rimshot_v2/v4` |
| `snare.xstick` | Snare Drum, Modern 3 — `Snare4_Xstick_v2_rr1/rr2` |
| `hihat` | Hi-Hat Cymbal — `HiHat_HitC_v2/v3/v4`, both round robins |
| `hihat.open` | Hi-Hat Cymbal — `HiHat_HitO_rr1/rr2` |
| `hihat.half` | Hi-Hat Cymbal — `HiHat_HitLoose_rr1/rr2` |
| `hhfoot` | Hi-Hat Cymbal — `HiHat_Close_rr1/rr2` (the pedal chick) |
| `ride` | Suspended Cymbal 1 — `hit_stick_pp/mp/f`, ×1.22 speed |
| `ride.bell` | Suspended Cymbal 2 — `hit_bell_p/f`, ×1.15 speed |
| `ride.crash` | Suspended Cymbal 1 — `hit_stick_mp/f`, ×1.22, left ringing |
| `crash` | Suspended Cymbal 1 — `hit_stick_mp/f`, ×0.88 speed |
| `tom.hi` | Tom 1 Stick — `TomH_HitS_v2/v3/v4` |
| `tom.low` | Tom 2 Stick — `TomL_HitS_v2/v3/v4` |

Modern 3 is the snare because it is the only one in the library with a rim shot
and a cross-stick alongside its plain hits — a rim shot recorded on a different
drum than the notes around it is immediately obvious.

The cymbals took three attempts, and the lesson was to go by what the
recordings measure rather than by what they are called.

**Clash Cymbals are not a kit crash.** They are the orchestral pair struck
together in two hands. The one bolted to a drum kit is a suspended cymbal hit
hard with a stick.

**`hit_f` / `hit_fff` are not strikes.** Their peak arrives 113–572ms after the
sound begins, which is a mallet swell. Only the `hit_stick_` files have a real
attack, at 1–2ms.

That leaves one usable stick set, because Suspended Cymbal 2's is not
well-behaved — its loudest layer measures duller and slower-attacked than its
middle one, so hitting harder would have sounded softer:

| | pp | mp | loudest |
|---|---|---|---|
| Cymbal 1, stick | 3579 Hz / 1ms | 4207 Hz / 2ms | 4277 Hz / 2ms |
| Cymbal 2, stick | 5024 Hz / 96ms | 5631 Hz / 10ms | 4388 Hz / 75ms |

So both cymbals are Cymbal 1's stick hits at different tape speeds, which is
also the truth of it: pitch is most of what separates a ride from a crash. The
built pack measures hi-hat 8166Hz, bell 4716, ride 4505 over 0.95s, crashed
ride 4515 over 2.2s, crash 3844 over 2.8s — high and tight down to low and
long, in the order a kit sits in.

`scripts/build-kit.mjs` regenerates the pack: it fetches the sources, trims the
leading silence, caps each length, fades the cut, downmixes to mono, resamples,
peak-normalises **per slot** (one factor for all its layers, so the velocity
differences survive) and encodes mono MP3 at 96kbps. It needs network, `ffmpeg`
and `sox`. The output is committed, so a normal build never runs it.

Each slot's peak *before* normalising is kept in `pack.json`, because
normalising is exactly what destroys the difference between a rim shot and a
cross-stick. Within one instrument those peaks are comparable — same session,
same mics — so the runtime uses the ratio to put the recorded balance back:

| | vs its plain stroke |
|---|---|
| rim shot | +3.0dB |
| cross-stick | −12.9dB |
| open hi-hat | +0.5dB |
| half-open | +1.6dB |
| pedal chick | −10.0dB |
| ride bell | +4.3dB |

Across instruments the peaks say nothing, so drum-against-drum balance is the
hand-set gains in `src/audio/pack.ts`. Tune those and no re-encoding is needed.
