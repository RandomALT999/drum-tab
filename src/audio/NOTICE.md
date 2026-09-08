# Sound pack — `public/kit/`

Built from two sources.

## The kit — MuldjordKit (CC-BY 4.0)

Kick, snare, hi-hat, ride (+ bell), crash and all three toms are
**MuldjordKit**, recorded by Lars Muldjord for the DrumGizmo project —
<https://github.com/sfzinstruments/DrumGizmo.MuldjordKit> — a Tama Superstar
kit tracked during actual album sessions (Sepulchrum, 2010). Released under
**Creative Commons Attribution 4.0**: redistributable, unlike most free drum
libraries (which turn out to be CC-BY-SA or "royalty free for music
production" — a license to use the sound in a song, not to hand the sound
file itself to someone else's software), but it does require the credit
above if this pack goes out publicly.

The kit has two kicks, two rides and two crashes recorded; only the right-hand
ride and right-hand crash are used below; the left ones, and the extra third
rack tom, are unused rather than missing — see `scripts/build-kit.mjs` if a
different pick is ever wanted. Every piece is real velocity layers and real
round robins, close-miked per drum (crash and china have no dedicated mic —
picked up on the stereo overheads instead, mixed to mono here).

Sources per slot:

| slot | MuldjordKit piece / mic |
|---|---|
| `kick` | KdrumR — hits 1 / 4 / 20 |
| `snare` | Snare, top mic — hits 1 / 20 / 50 |
| `hihat` | HihatClosed — hits 1 / 11 / 20 |
| `hihat.open` | HihatOpen — hits 2 / 8 / 15 |
| `ride` | RideR — hits 1 / 5 / 7 |
| `ride.bell` | RideRBell, RideR mic — hits 1 / 5 / 7 |
| `ride.crash` | RideR — hits 7 / 9, same recording as `ride`'s top layer, just given more room to ring (2.5s vs 1.5s) |
| `crash` | CrashR — overheads L+R mixed to mono, hits 6 / 9 |
| `tom.hi` | Tom1 — hits 1 / 5 / 7 |
| `tom.mid` | Tom2 — hits 1 / 5 / 8 |
| `tom.low` | Tom4 (the floor tom) — hits 1 / 6 / 9 |

Hit numbers run soft to loud within a piece — confirmed against the kit's own
SFZ region files, which group them into named velocity bands in that order —
so a low/middle/high hit number is a real soft/medium/loud triad, not a guess
from file order.

## What MuldjordKit doesn't have — still VCSL (CC0)

The snare rim shot, the snare cross-stick, the half-open hi-hat, and the
hi-hat pedal chick were never recorded on this kit. Those four still come
from the **Versilian Community Sample Library (VCSL)** by Versilian Studios,
<https://github.com/sgossner/VCSL>, CC0 1.0 — public domain, nothing owed.

| slot | VCSL instrument |
|---|---|
| `snare.rim` | Snare Drum, Modern 3 — `Snare4_rimshot_v2/v4` |
| `snare.xstick` | Snare Drum, Modern 3 — `Snare4_Xstick_v2_rr1/rr2` |
| `hihat.half` | Hi-Hat Cymbal — `HiHat_HitLoose_rr1/rr2` |
| `hhfoot` | Hi-Hat Cymbal — `HiHat_Close_rr1/rr2` |

The rim shot and cross-stick are consequently a different physical snare than
the plain hit sitting next to them on the staff. Audible if you listen for
it, but the alternative — no sound at all for those techniques — is worse.
Fixing it properly means recording (or finding) a rim shot and cross-stick on
the actual MuldjordKit snare, not a build-script change.

## Build

`scripts/build-kit.mjs` regenerates the pack: it fetches the sources, trims
the leading silence, caps each length, fades the cut, downmixes to mono
(summing both overhead mics at half gain each for the crash, so they can't
clip), resamples, peak-normalises **per slot** (one factor for all its
layers, so the velocity differences survive) and encodes mono MP3 at 96kbps.
It needs network, `ffmpeg` and `sox`. The output is committed, so a normal
build never runs it.

Each slot's peak *before* normalising is kept in `pack.json`, because
normalising is exactly what destroys the difference between, say, a rim shot
and a cross-stick. Within one instrument those peaks are comparable — same
session, same mics — so the runtime (`src/audio/pack.ts`, `FAMILY`) uses the
ratio to put the recorded balance back. The old VCSL-only pack needed a
hand-set `TRIM` correction on top of that ratio for `ride.crash` and
`ride.bell`, because both were borrowed from a different recording than the
`ride` they sat next to — a pitch-shifted copy of the same take for one, an
unrelated cymbal for the other — so their raw peaks didn't mean what a shared
session's peaks normally mean. MuldjordKit's ride, bell and crashed-ride
really are the same cymbal and the same session, so `TRIM` is empty now; the
family ratio alone is correct.

Across instruments — kick against snare against crash — the peaks say
nothing, so that balance is the hand-set gains in `src/audio/pack.ts`. Tune
those and no re-encoding is needed.
