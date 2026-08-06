import type { App } from '../App';
import type { Bar } from '../model/types';
import { ACCENT, softAccent } from '../config';
import { buildBar } from '../notation/layout';
import { Staff } from '../notation/Staff';

export function PlayMode({ app }: { app: App }) {
  const st = app.state;
  const p = app.proj();
  const part = app.curPart();
  const soft = softAccent(ACCENT);
  const vb = app.viewBox(true);
  const loopOn = !!(st.loop && st.loop.a && st.loop.b);
  const speedLabel = (st.speed === 1 ? '1' : String(st.speed).replace('0.', '.')) + '×';

  const parts = st.scope === 'song' ? p.parts : [part];
  const flat: { bar: Bar; gi: number; partName: string; prev: Bar | null }[] = [];
  let gi = 0;
  let prev: Bar | null = null;
  parts.forEach((pt) =>
    pt.bars.forEach((bar) => {
      flat.push({ bar, gi: gi++, partName: pt.name, prev });
      prev = bar;
    }),
  );

  return (
    <div
      onClick={app.togglePlay}
      style={{
        width: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px 6px',
          paddingTop: 'calc(8px + env(safe-area-inset-top))',
          flex: 'none',
        }}
      >
        <div
          style={{
            font: '500 12px Helvetica Neue,Helvetica,sans-serif',
            color: 'rgba(236,231,221,.65)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {p.title} · {st.scope === 'song' ? 'full song' : part.name}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            font: '600 11px IBM Plex Mono,monospace',
            letterSpacing: '.08em',
            color: ACCENT,
            whiteSpace: 'nowrap',
          }}
        >
          {p.bpm} BPM · {speedLabel}
          {loopOn ? ' · LOOP' : ''}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            app.exitPlayWake();
            app.setState({ view: 'edit' });
          }}
          aria-label="Back to editor"
          style={{
            width: 34,
            height: 34,
            border: '1px solid rgba(236,231,221,.18)',
            borderRadius: 9,
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            color: 'rgba(236,231,221,.6)',
            flex: 'none',
          }}
        >
          ✕
        </button>
      </div>

      <div
        ref={app.setScroller}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '4px 16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 18px',
          alignContent: 'flex-start',
        }}
      >
        {flat.map(({ bar, gi: i, partName, prev: pv }) => {
          const hot = st.cur && st.cur.barId === bar.id ? st.cur.s : -1;
          const render = buildBar(bar, {
            hot,
            drag: null,
            selId: null,
            acc: ACCENT,
            softAcc: soft,
            loop: st.loop,
            showBeats: false,
            play: true,
            prev: pv,
            gi: i,
          });
          return (
            <div
              key={bar.id + '-' + i}
              ref={(el) => {
                if (el) app.barEls[bar.id] = el;
              }}
              style={{ flex: '1 1 42%', minWidth: 320 }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 2 }}>
                <span
                  style={{
                    font: '600 10px IBM Plex Mono,monospace',
                    color: hot >= 0 ? ACCENT : 'rgba(236,231,221,.4)',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    font: '400 9px IBM Plex Mono,monospace',
                    letterSpacing: '.1em',
                    color: 'rgba(236,231,221,.28)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {partName}
                </span>
              </div>
              <Staff
                b={render}
                vb={vb}
                acc={ACCENT}
                labels={st.labels}
                maxHeight="min(230px,42vh)"
                play
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: 'none',
          display: 'flex',
          justifyContent: 'center',
          gap: 22,
          padding: '6px 0 10px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          font: '400 9px IBM Plex Mono,monospace',
          letterSpacing: '.14em',
          color: 'rgba(236,231,221,.3)',
        }}
      >
        <span>{st.count ? 'COUNT ' + st.count : st.playing ? 'PLAYING' : 'PAUSED'}</span>
        <span>TAP ANYWHERE TO {st.playing ? 'PAUSE' : 'PLAY'}</span>
        <span>{st.wake ? 'SCREEN AWAKE' : 'AUTO-SCROLL'}</span>
      </div>
    </div>
  );
}
