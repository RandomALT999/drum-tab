import type { App } from '../App';

export function PartsStrip({ app }: { app: App }) {
  const st = app.state;
  const compact = st.compact;
  const p = app.proj();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: compact ? '5px 14px' : '10px 14px',
        borderBottom: '1px solid rgba(236,231,221,.12)',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 'none',
      }}
    >
      {p.parts.map((pt, i) => (
        <button
          key={pt.id}
          onClick={() => app.setState({ part: i, bar: 0, sel: null })}
          onDoubleClick={() => app.setState({ part: i, sheet: { k: 'part' } })}
          style={{
            padding: compact ? '6px 12px' : '9px 13px',
            borderRadius: 20,
            font: '500 11.5px Helvetica Neue,Helvetica,sans-serif',
            whiteSpace: 'nowrap',
            flex: 'none',
            background: i === st.part ? '#ece7dd' : '#17171c',
            color: i === st.part ? '#0d0d10' : 'rgba(236,231,221,.55)',
          }}
        >
          {pt.name}
        </button>
      ))}
      <button
        onClick={() => app.setState({ sheet: { k: 'feel', target: 'part' } })}
        aria-label="Add part"
        style={{
          padding: compact ? '6px 11px' : '9px 12px',
          border: '1px dashed rgba(236,231,221,.25)',
          borderRadius: 20,
          font: '400 11.5px IBM Plex Mono,monospace',
          color: 'rgba(236,231,221,.45)',
          flex: 'none',
        }}
      >
        +
      </button>
      <div style={{ flex: 1, minWidth: 8 }} />
      <button
        onClick={() => app.setState({ sheet: { k: 'part' } })}
        aria-label="Part menu"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: '#17171c',
          display: 'grid',
          placeItems: 'center',
          font: '500 13px IBM Plex Mono,monospace',
          color: 'rgba(236,231,221,.55)',
          flex: 'none',
        }}
      >
        ⋯
      </button>
    </div>
  );
}
