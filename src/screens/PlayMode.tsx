import type { App } from '../App';
import type { Bar } from '../model/types';
import { ACCENT, SAFE_BOTTOM, softAccent } from '../config';
import { SPEEDS } from '../notation/constants';
import { buildBar } from '../notation/layout';
import { Staff } from '../notation/Staff';

export function PlayMode({ app }: { app: App }) {
  const st = app.state;
  const p = app.proj();
  const part = app.curPart();
  const soft = softAccent(ACCENT);
  const vb = app.viewBox(true);
  const { width: barW, cap } = app.barLayout(true);
  // hoisted: br() scans every bar on screen, so it must not run once per bar
  const br = app.br(true);
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

  // gi indexes this flattened run, so the loop has to be located in it too
  const loop = app.loopRange(flat.map((f) => f.bar));

  return (
    <div
      className="screen"
      onClick={app.togglePlay}
      style={{
        width: '100%',
        background: '#0d0d10',
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
          flex: 'none',
        }}
      >
        <div
          style={{
            font: '500 14px Helvetica Neue,Helvetica,sans-serif',
            color: 'rgba(236,231,221,.7)',
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
            font: '600 12.5px IBM Plex Mono,monospace',
            letterSpacing: '.06em',
            color: ACCENT,
            whiteSpace: 'nowrap',
          }}
        >
          {p.bpm} BPM{loopOn ? ' · LOOP' : ''}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const i = (SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length;
            app.setState({ speed: SPEEDS[i] }, () => {
              if (app.state.playing) app.restart();
            });
          }}
          aria-label="Playback speed"
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 9,
            border: '1px solid rgba(236,231,221,.18)',
            font: '600 13px IBM Plex Mono,monospace',
            color: st.speed === 1 ? 'rgba(236,231,221,.6)' : ACCENT,
            flex: 'none',
          }}
        >
          {speedLabel}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            app.exitPlayWake();
            app.setState({ view: 'edit' });
          }}
          aria-label="Back to editor"
          style={{
            width: 38,
            height: 38,
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
        className="pane"
        ref={app.setPlayPane}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: st.compact ? 'hidden' : 'auto',
          overflowX: st.compact ? 'auto' : 'hidden',
          padding: st.compact ? '4px 0 6px' : '6px 14px 16px',
          display: 'flex',
          flexWrap: st.compact ? 'nowrap' : 'wrap',
          gap: st.compact ? '0' : '10px 16px',
          alignContent: 'flex-start',
          scrollSnapType: st.compact ? 'x mandatory' : undefined,
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
            loop,
            showBeats: false,
            play: true,
            prev: pv,
            gi: i,
            br,
          });
          return (
            <div
              key={bar.id + '-' + i}
              ref={(el) => {
                if (el) app.barEls[bar.id] = el;
              }}
              style={{
                width: barW,
                flex: 'none',
                scrollSnapAlign: st.compact ? 'start' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 2 }}>
                <span
                  style={{
                    font: '600 12px IBM Plex Mono,monospace',
                    color: hot >= 0 ? ACCENT : 'rgba(236,231,221,.4)',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    font: '400 10px IBM Plex Mono,monospace',
                    letterSpacing: '.1em',
                    color: 'rgba(236,231,221,.3)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {partName}
                </span>
              </div>
              <Staff
                br={br}
                b={render}
                vb={vb}
                acc={ACCENT}
                labels={st.labels}
                maxHeight={cap}
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
          paddingTop: 6,
          paddingBottom: SAFE_BOTTOM,
          font: '400 10px IBM Plex Mono,monospace',
          letterSpacing: '.12em',
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
