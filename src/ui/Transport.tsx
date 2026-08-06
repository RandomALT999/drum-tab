import type { App } from '../App';
import { ACCENT, softAccent } from '../config';
import { SPEEDS } from '../notation/constants';

const chipAt =
  (h: number) =>
  (bg: string, color: string, pad = 12): React.CSSProperties => ({
    height: h,
    padding: `0 ${pad}px`,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    font: '600 9.5px IBM Plex Mono,monospace',
    letterSpacing: '.1em',
    flex: 'none',
    background: bg,
    color,
  });

export function Transport({ app }: { app: App }) {
  const st = app.state;
  const p = app.proj();
  const soft = softAccent(ACCENT);
  const H = st.compact ? 38 : 46;
  const chip = chipAt(H);
  const loopOn = !!(st.loop && st.loop.a && st.loop.b);
  const loopActive = st.loopArm || loopOn;
  const speedLabel = (st.speed === 1 ? '1' : String(st.speed).replace('0.', '.')) + '×';

  const loopLabel = st.loopArm
    ? st.loop && st.loop.a && !st.loop.b
      ? 'TAP END'
      : 'TAP START'
    : loopOn
      ? 'LOOP ON'
      : 'LOOP';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: st.compact ? '6px 14px' : '11px 14px',
        borderBottom: '1px solid rgba(236,231,221,.12)',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 'none',
      }}
    >
      <button
        onClick={app.togglePlay}
        aria-label={st.playing ? 'Pause' : 'Play'}
        style={{
          width: H,
          height: H,
          borderRadius: '50%',
          background: ACCENT,
          color: '#0d0d10',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
        }}
      >
        <svg width="15" height="17" viewBox="0 0 14 16">
          <path
            d={st.playing ? 'M2 1h3.6v14H2zM8.4 1H12v14H8.4z' : 'M1 1 13 8 1 15Z'}
            fill="currentColor"
          />
        </svg>
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#17171c',
          borderRadius: 10,
          height: H,
          flex: 'none',
        }}
      >
        <button
          onClick={() => app.edit((pp) => void (pp.bpm = Math.max(30, pp.bpm - 1)), undefined, 'bpm')}
          aria-label="Decrease tempo"
          style={{
            width: 34,
            height: H,
            display: 'grid',
            placeItems: 'center',
            font: '400 18px IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.5)',
          }}
        >
          −
        </button>
        <div style={{ textAlign: 'center', minWidth: 36 }}>
          <div style={{ font: '500 18px/1 IBM Plex Mono,monospace' }}>{p.bpm}</div>
          <div
            style={{
              font: '400 7px/1.6 IBM Plex Mono,monospace',
              letterSpacing: '.14em',
              color: 'rgba(236,231,221,.4)',
            }}
          >
            BPM
          </div>
        </div>
        <button
          onClick={() => app.edit((pp) => void (pp.bpm = Math.min(300, pp.bpm + 1)), undefined, 'bpm')}
          aria-label="Increase tempo"
          style={{
            width: 34,
            height: H,
            display: 'grid',
            placeItems: 'center',
            font: '400 18px IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.5)',
          }}
        >
          +
        </button>
      </div>

      <button
        onClick={() => {
          const i = (SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length;
          app.setState({ speed: SPEEDS[i] }, () => {
            if (app.state.playing) app.restart();
          });
        }}
        style={{ ...chip('#17171c', '#ece7dd'), font: '500 11px IBM Plex Mono,monospace' }}
      >
        {speedLabel}
      </button>

      <button
        onClick={() => app.setState({ met: !st.met })}
        style={chip(
          st.met ? soft : '#17171c',
          st.met ? ACCENT : 'rgba(236,231,221,.45)',
          13,
        )}
      >
        METRONOME
      </button>

      <button
        onClick={() => {
          if (loopOn)
            app.setState({ loop: null, loopArm: false }, () => {
              if (app.state.playing) app.restart();
            });
          else app.setState({ loopArm: !st.loopArm, loop: null });
        }}
        style={chip(
          loopActive ? soft : '#17171c',
          loopActive ? ACCENT : 'rgba(236,231,221,.45)',
        )}
      >
        {loopLabel}
      </button>

      <button
        onClick={() => app.setState({ labels: !st.labels })}
        style={chip(
          st.labels ? soft : '#17171c',
          st.labels ? ACCENT : 'rgba(236,231,221,.45)',
        )}
      >
        KEY
      </button>

      <button
        onClick={() =>
          app.setState({ scope: st.scope === 'part' ? 'song' : 'part' }, () => {
            if (app.state.playing) app.restart();
          })
        }
        style={chip('#17171c', 'rgba(236,231,221,.7)')}
      >
        {st.scope === 'part' ? 'PART' : 'SONG'}
      </button>
    </div>
  );
}
