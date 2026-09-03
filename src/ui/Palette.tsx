import type { ReactNode } from 'react';
import type { App } from '../App';
import { ACCENT, SAFE_BOTTOM } from '../config';
import { CH, VI } from '../notation/constants';

const glyph = (
  w: number,
  h: number,
  vb: string,
  x: number,
  y: number,
  fs: number,
  ch: string,
): ReactNode => (
  <svg width={w} height={h} viewBox={vb} style={{ display: 'block', flex: 'none' }}>
    <text x={x} y={y} fontFamily="Noto Music" fontSize={fs} fill="currentColor">
      {ch}
    </text>
  </svg>
);

const smallChip = (bg: string, color: string): React.CSSProperties => ({
  height: 30,
  padding: '0 11px',
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  font: '600 9.5px IBM Plex Mono,monospace',
  letterSpacing: '.08em',
  flex: 'none',
  background: bg,
  color,
});

export function Palette({ app }: { app: App }) {
  const st = app.state;
  const compact = st.compact;
  const sn = app.selNote();

  // The eight buttons are dual-purpose: with a note selected they edit it and
  // reflect its values (so the row doubles as an inspector); with nothing
  // selected they set the defaults for the next note placed.
  const dv = sn ? sn.d : st.dur;
  const av = sn ? sn.a : st.art;
  const btn = (on: boolean) => ({
    background: on ? ACCENT : '#17171c',
    color: on ? '#0d0d10' : 'rgba(236,231,221,.72)',
  });

  const tgtLabel = st.count
    ? 'COUNT-IN · ' + st.count
    : st.loopArm
      ? 'TAP LOOP START, THEN END'
      : sn
        ? 'SELECTED · ' + VI[sn.v].nm.toUpperCase()
        : 'NEW NOTES · TAP THE STAFF';
  const tgtFg = sn || st.count || st.loopArm ? ACCENT : 'rgba(236,231,221,.4)';

  const cell = (
    on: boolean,
    label: string,
    body: ReactNode,
    onClick: () => void,
    enabled = true,
  ): ReactNode => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        height: compact ? 42 : 54,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        ...btn(on),
        // a value the selected note can't legally take reads as unavailable
        opacity: enabled ? 1 : 0.32,
      }}
    >
      {body}
      <span style={{ font: '600 9px IBM Plex Mono,monospace', letterSpacing: '.03em' }}>
        {label}
      </span>
    </button>
  );

  return (
    <div
      style={{
        borderTop: '1px solid rgba(236,231,221,.12)',
        background: '#0d0d10',
        flex: 'none',
        paddingTop: compact ? 5 : 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingBottom: SAFE_BOTTOM,
        display: compact ? 'flex' : undefined,
        alignItems: compact ? 'center' : undefined,
        gap: compact ? 10 : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          // landscape has width to spare and no height to spare, so the context
          // chips sit beside the buttons instead of above them
          padding: compact ? '0' : '0 2px 7px',
          order: compact ? 2 : 0,
          flex: compact ? 'none' : undefined,
        }}
      >
        <span
          style={{
            font: '600 9.5px IBM Plex Mono,monospace',
            letterSpacing: '.1em',
            color: tgtFg,
            whiteSpace: 'nowrap',
            flex: 'none',
            display: compact ? 'none' : undefined,
          }}
        >
          {tgtLabel}
        </span>
        <div style={{ flex: 1, minWidth: 4 }} />

        {compact && (
          <>
            <button
              onClick={() => app.stepBar(-1)}
              aria-label="Previous bar"
              style={{
                ...smallChip('#1c1c22', 'rgba(236,231,221,.6)'),
                padding: '0 11px',
                fontSize: 13,
              }}
            >
              ‹
            </button>
            <button
              onClick={() => app.stepBar(1)}
              aria-label="Next bar"
              style={{
                ...smallChip('#1c1c22', 'rgba(236,231,221,.6)'),
                padding: '0 11px',
                fontSize: 13,
              }}
            >
              ›
            </button>
          </>
        )}
        <button
          onClick={() => app.undo()}
          disabled={!st.canUndo}
          aria-label="Undo"
          style={{
            ...smallChip(
              '#1c1c22',
              st.canUndo ? 'rgba(236,231,221,.6)' : 'rgba(236,231,221,.22)',
            ),
            padding: '0 9px',
            fontSize: 12,
            letterSpacing: 0,
            cursor: st.canUndo ? 'pointer' : 'default',
          }}
        >
          ↶
        </button>
        <button
          onClick={() => app.redo()}
          disabled={!st.canRedo}
          aria-label="Redo"
          style={{
            ...smallChip(
              '#1c1c22',
              st.canRedo ? 'rgba(236,231,221,.6)' : 'rgba(236,231,221,.22)',
            ),
            padding: '0 9px',
            fontSize: 12,
            letterSpacing: 0,
            cursor: st.canRedo ? 'pointer' : 'default',
          }}
        >
          ↷
        </button>

        <button
          onClick={() => app.setState({ sheet: { k: 'addbar' } })}
          style={{
            ...smallChip('transparent', 'rgba(236,231,221,.55)'),
            border: '1px dashed rgba(236,231,221,.22)',
          }}
        >
          + BAR
        </button>
        <button
          onClick={() => {
            if (sn && st.sel) {
              app.setState({ sel: null });
              app.mutNote(st.sel.barId, sn.id, () => null);
              app.flash('DELETED');
            } else {
              app.edit((pp) => {
                const bs = pp.parts[st.part].bars;
                bs[Math.min(st.bar, bs.length - 1)].notes = [];
              }, 'BAR CLEARED');
            }
          }}
          style={smallChip(
            sn ? '#2a1c1e' : '#1c1c22',
            sn ? 'oklch(0.72 0.16 25)' : 'rgba(236,231,221,.5)',
          )}
        >
          {sn ? 'DELETE' : 'CLEAR'}
        </button>
      </div>

      <div
        style={{ display: 'flex', gap: 5, flex: compact ? '1 1 auto' : undefined, minWidth: 0 }}
      >
        {cell(
          dv === 4,
          '1/4',
          glyph(10, 26, '0 0 13 34', 0, 32.5, 32, CH.d4),
          () => app.applyDur(4),
          app.durAllowed(4),
        )}
        {cell(
          dv === 8,
          '1/8',
          glyph(16, 26, '0 0 20 34', 0, 32.5, 32, CH.d8),
          () => app.applyDur(8),
          app.durAllowed(8),
        )}
        {cell(dv === 16, '1/16', glyph(16, 26, '0 0 21 34', 0, 32.5, 32, CH.d16), () =>
          app.applyDur(16),
        )}
        {cell(
          !!(sn && sn.rest),
          'REST',
          glyph(11, 26, '0 0 14 32', 0, 28, 28, CH.r4),
          app.toggleRest,
        )}
        {cell(av === 'normal', 'PLAIN', glyph(11, 11, '0 0 9 9', -0.5, 6.7, 22, CH.headN), () =>
          app.applyArt('normal'),
        )}
        {cell(
          av === 'accent',
          'ACCENT',
          <svg
            width="18"
            height="11"
            viewBox="0 0 18 11"
            style={{ display: 'block', flex: 'none' }}
          >
            <path
              d="M2 2L16 5.5L2 9"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>,
          () => app.applyArt('accent'),
        )}
        {cell(
          av === 'ghost',
          'GHOST',
          <span style={{ font: '400 15px/1 IBM Plex Mono,monospace' }}>( )</span>,
          () => app.applyArt('ghost'),
        )}
        {cell(
          av === 'open',
          'OPEN',
          <span style={{ font: '400 14px/1 IBM Plex Mono,monospace' }}>○</span>,
          () => app.applyArt('open'),
        )}
      </div>
    </div>
  );
}
