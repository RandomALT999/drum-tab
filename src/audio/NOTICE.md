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
| `ride` | Suspended Cymbal 2 — `hit_stick_pp/mp/mf` |
| `ride.bell` | Suspended Cymbal 2 — `hit_bell_p/f` |
| `ride.crash` | Suspended Cymbal 2 — `hit_mf/fff` (the same cymbal, hit full) |
| `crash` | Clash Cymbals 1 — `cymbal_crash1_mf1/ff2` |
| `tom.hi` | Tom 1 Stick — `TomH_HitS_v2/v3/v4` |
| `tom.low` | Tom 2 Stick — `TomL_HitS_v2/v3/v4` |

Modern 3 is the snare because it is the only one in the library with a rim shot
and a cross-stick alongside its plain hits — a rim shot recorded on a different
drum than the notes around it is immediately obvious.

The cymbals were chosen by measuring their spectral centroids, after a first
pass put them the wrong way round:

| | centroid |
|---|---|
| Suspended Cymbal 2, stick | 5631 Hz |
| Clash Cymbals 1 | 5170 Hz |
| Suspended Cymbal 2, bell | 4426 Hz |
| Suspended Cymbal 1, stick | 4207 Hz |
| Suspended Cymbal 1, bell | 3457 Hz |

The bright cymbal had been on the crash line, where a stick tap on a suspended
cymbal just sounds like a ride, while the ride line got the darker one — and
Cymbal 1's bell was the dullest thing in the kit, for the sound that should ping
hardest. So the ride, its bell and its crash all come off Suspended Cymbal 2,
which also means crashing the ride is the same instrument as riding it, and the
crash line moves to clash cymbals: two cymbals struck together, which is a
crash.

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
