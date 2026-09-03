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
| `snare` | Snare Drum, Modern 1 — `Snare2_HitSN_v5/v7/v9`, both round robins |
| `hihat` | Hi-Hat Cymbal — `HiHat_HitC_v2/v3/v4`, both round robins |
| `hihat.open` | Hi-Hat Cymbal — `HiHat_HitO_rr1/rr2` |
| `ride` | Suspended Cymbal 1 — `hit_stick_pp/mp/f` |
| `ride.bell` | Suspended Cymbal 1 — `hit_bell_mf` |
| `crash` | Suspended Cymbal 2 — `hit_stick_mp/mf` |
| `tom.hi` | Tom 1 Stick — `TomH_HitS_v2/v3/v4` |
| `tom.low` | Tom 2 Stick — `TomL_HitS_v2/v3/v4` |

`scripts/build-kit.mjs` regenerates the pack: it fetches the sources, trims the
leading silence, caps each length, fades the cut, downmixes to mono, resamples,
peak-normalises **per slot** (one factor for all its layers, so the velocity
differences survive) and encodes mono MP3 at 96kbps. It needs network, `ffmpeg`
and `sox`. The output is committed, so a normal build never runs it.

The mix balance lives in `src/audio/pack.ts`, not in the files — every slot is
normalised to the same ceiling, so those gains are what stops a cymbal being as
loud as a kick. Tune them there and no re-encoding is needed.
