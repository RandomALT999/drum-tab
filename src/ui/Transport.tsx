import type { App } from '../App';
import { ACCENT, softAccent } from '../config';
import { SPEEDS } from '../notation/constants';

export function Transport({ app }: { app: App }) {
  const st = app.state;
  const p = app.proj();
  const soft = softAccent(ACCENT);
  const H = st.compact ? 42 : 50;
  const fs = st.compact ? 10 : 10.5;
  const loopOn = !!(st.loop && st.loop.a && st.loop.b);
  const loopActive = st.loopArm || loopOn;
  const speedLabel = (st.speed === 1 ? '1' : String(st.speed).replace('0.', '.')) + '×';

  const chip = (bg: string, color: string, pad = 11): React.CSSProperties => ({
    height: H,
    padding: `0 ${pad}px`,
    borderRadius: 11,
    display: 'grid',
    placeItems: 'center',
    font: `600 ${fs}px IBM Plex Mono,monospace`,
    letterSpacing: '.08em',
    whiteSpace: 'nowrap',
    flex: 'none',
    background: bg,
    color,
  });

  // Short enough that the row fits a 393px phone without scrolling sideways.
  const loopLabel = st.loopArm
    ? st.loop && st.loop.a && !st.loop.b
      ? 'SET B'
      : 'SET A'
    : loopOn
      ? 'LOOP ON'
      : 'LOOP';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: st.compact ? '6px 12px' : '10px 12px',
        borderBottom: '1px solid rgba(236,231,221,.12)',
        // wrap rather than scroll — reaching a control must never need a swipe
        flexWrap: 'wrap',
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
        <svg width="17" height="19" viewBox="0 0 14 16">
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
          borderRadius: 11,
          height: H,
          flex: 'none',
        }}
      >
        <button
          onClick={() =>
            app.edit((pp) => void (pp.bpm = Math.max(30, pp.bpm - 1)), undefined, 'bpm')
          }
          aria-label="Decrease tempo"
          style={{
            width: 34,
            height: H,
            display: 'grid',
            placeItems: 'center',
            font: '400 21px IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.55)',
          }}
        >
          −
        </button>
        <div style={{ textAlign: 'center', minWidth: 38 }}>
          <div style={{ font: '500 20px/1 IBM Plex Mono,monospace' }}>{p.bpm}</div>
          <div
            style={{
              font: '400 8px/1.5 IBM Plex Mono,monospace',
              letterSpacing: '.14em',
              color: 'rgba(236,231,221,.45)',
            }}
          >
            BPM
          </div>
        </div>
        <button
          onClick={() =>
            app.edit((pp) => void (pp.bpm = Math.min(300, pp.bpm + 1)), undefined, 'bpm')
          }
          aria-label="Increase tempo"
          style={{
            width: 34,
            height: H,
            display: 'grid',
            placeItems: 'center',
            font: '400 21px IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.55)',
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
        style={{ ...chip('#17171c', '#ece7dd'), font: '500 13px IBM Plex Mono,monospace' }}
      >
        {speedLabel}
      </button>

      <button
        onClick={() => app.setState({ met: !st.met })}
        style={chip(st.met ? soft : '#17171c', st.met ? ACCENT : 'rgba(236,231,221,.5)')}
      >
        CLICK
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
          loopActive ? ACCENT : 'rgba(236,231,221,.5)',
        )}
      >
        {loopLabel}
      </button>
    </div>
  );
}
