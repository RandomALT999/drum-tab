import type { App } from '../App';
import { ACCENT, softAccent } from '../config';

export function PartsStrip({ app }: { app: App }) {
  const st = app.state;
  const compact = st.compact;
  const p = app.proj();
  const soft = softAccent(ACCENT);
  const H = compact ? 32 : 38;

  // KEY and the part/song scope live here rather than in the transport: they
  // are view options, they are set rarely, and moving them is what lets the
  // transport fit a phone on one row.
  const opt = (on: boolean): React.CSSProperties => ({
    height: H,
    padding: '0 10px',
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    font: `600 ${compact ? 9.5 : 10}px IBM Plex Mono,monospace`,
    letterSpacing: '.08em',
    flex: 'none',
    background: on ? soft : '#17171c',
    color: on ? ACCENT : 'rgba(236,231,221,.5)',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: compact ? '0 12px' : '7px 12px',
        borderBottom: compact ? 'none' : '1px solid rgba(236,231,221,.12)',
        flex: 'none',
      }}
    >
      {/* only the part list itself may scroll — it is a list, and it grows */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          flex: '1 1 auto',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {p.parts.map((pt, i) => (
          <button
            key={pt.id}
            onClick={() => app.setState({ part: i, bar: 0, sel: null })}
            onDoubleClick={() => app.setState({ part: i, sheet: { k: 'part' } })}
            style={{
              height: H,
              padding: '0 13px',
              borderRadius: 19,
              font: '500 12.5px Helvetica Neue,Helvetica,sans-serif',
              whiteSpace: 'nowrap',
              flex: 'none',
              background: i === st.part ? '#ece7dd' : '#17171c',
              color: i === st.part ? '#0d0d10' : 'rgba(236,231,221,.6)',
            }}
          >
            {pt.name}
          </button>
        ))}
        <button
          onClick={() => app.setState({ sheet: { k: 'feel', target: 'part' } })}
          aria-label="Add part"
          style={{
            height: H,
            padding: '0 13px',
            border: '1px dashed rgba(236,231,221,.28)',
            borderRadius: 19,
            font: '400 14px IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.5)',
            flex: 'none',
          }}
        >
          +
        </button>
      </div>

      <button onClick={() => app.setState({ labels: !st.labels })} style={opt(st.labels)}>
        KEY
      </button>
      <button
        onClick={() =>
          app.setState({ scope: st.scope === 'part' ? 'song' : 'part' }, () => {
            if (app.state.playing) app.restart();
          })
        }
        style={opt(st.scope === 'song')}
      >
        {st.scope === 'part' ? 'PART' : 'SONG'}
      </button>
      <button
        onClick={() => app.setState({ sheet: { k: 'part' } })}
        aria-label="Part menu"
        style={{
          width: H,
          height: H,
          borderRadius: 10,
          background: '#17171c',
          display: 'grid',
          placeItems: 'center',
          font: '500 14px IBM Plex Mono,monospace',
          color: 'rgba(236,231,221,.6)',
          flex: 'none',
        }}
      >
        ⋯
      </button>
    </div>
  );
}
