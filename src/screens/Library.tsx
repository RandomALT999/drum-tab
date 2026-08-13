import type { App } from '../App';
import { ACCENT, SAFE_BOTTOM } from '../config';

const meta = (p: import('../model/types').Project): string => {
  const n = p.parts.reduce((a, q) => a + q.bars.length, 0);
  return (
    n +
    (n === 1 ? ' BAR' : ' BARS') +
    ' · ' +
    p.bpm +
    ' BPM · ' +
    new Date(p.updated).toLocaleDateString()
  );
};

export function Library({ app }: { app: App }) {
  const { lib } = app.state;
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 560,
        padding: '22px 18px 40px',
        paddingBottom: `calc(24px + ${SAFE_BOTTOM})`,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              font: '600 10px IBM Plex Mono,monospace',
              letterSpacing: '.2em',
              color: 'rgba(236,231,221,.4)',
            }}
          >
            SHEETS
          </div>
          <div
            style={{
              font: '500 26px/1.1 Helvetica Neue,Helvetica,sans-serif',
              letterSpacing: '-.02em',
              marginTop: 6,
            }}
          >
            Your library
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <button
            onClick={() => app.setState({ sheet: { k: 'import' } })}
            aria-label="Add a shared sheet"
            style={{
              height: 44,
              padding: '0 14px',
              borderRadius: 22,
              border: '1px solid rgba(236,231,221,.22)',
              color: 'rgba(236,231,221,.6)',
              font: '600 12px IBM Plex Mono,monospace',
              letterSpacing: '.06em',
              flex: 'none',
            }}
          >
            PASTE
          </button>
          <button
            onClick={() => app.setState({ sheet: { k: 'feel', target: 'project' } })}
            style={{
              height: 44,
              padding: '0 16px',
              background: ACCENT,
              color: '#0d0d10',
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              font: '600 12px IBM Plex Mono,monospace',
              letterSpacing: '.06em',
              flex: 'none',
            }}
          >
            + NEW
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lib.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#17171c',
              borderRadius: 12,
              padding: '14px 15px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              onClick={() => app.openProject(p.id)}
              style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
            >
              <div
                style={{
                  font: '500 17px Helvetica Neue,Helvetica,sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.title}
              </div>
              <div
                style={{
                  font: '400 11px IBM Plex Mono,monospace',
                  letterSpacing: '.06em',
                  color: 'rgba(236,231,221,.42)',
                  marginTop: 5,
                }}
              >
                {meta(p)}
              </div>
            </div>
            <button
              onClick={() => void app.shareSheet(p)}
              aria-label="Share sheet"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#22222a',
                display: 'grid',
                placeItems: 'center',
                font: '500 20px/1 IBM Plex Mono,monospace',
                color: 'rgba(236,231,221,.7)',
                flex: 'none',
              }}
            >
              ↗
            </button>
            <button
              onClick={() => app.dupProject(p)}
              aria-label="Duplicate sheet"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#22222a',
                display: 'grid',
                placeItems: 'center',
                font: '500 19px/1 IBM Plex Mono,monospace',
                color: 'rgba(236,231,221,.7)',
                flex: 'none',
              }}
            >
              ⧉
            </button>
            <button
              onClick={() => app.delProject(p)}
              disabled={lib.length < 2}
              aria-label="Delete sheet"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#22222a',
                display: 'grid',
                placeItems: 'center',
                font: '500 20px/1 IBM Plex Mono,monospace',
                color: lib.length < 2 ? 'rgba(236,231,221,.2)' : 'rgba(236,231,221,.6)',
                cursor: lib.length < 2 ? 'default' : 'pointer',
                flex: 'none',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          font: '400 12px/1.7 IBM Plex Mono,monospace',
          color: 'rgba(236,231,221,.3)',
          marginTop: 4,
        }}
      >
        Everything autosaves to this device.
      </div>
    </div>
  );
}
