import type { App } from '../App';
import { ACCENT, SHOW_BEAT_NUMBERS, softAccent } from '../config';
import { SUBS } from '../notation/constants';
import { buildBar } from '../notation/layout';
import { Staff } from '../notation/Staff';
import { Transport } from '../ui/Transport';
import { PartsStrip } from '../ui/PartsStrip';
import { Palette } from '../ui/Palette';

export function Editor({ app }: { app: App }) {
  const st = app.state;
  const p = app.proj();
  const part = app.curPart();
  const sn = app.selNote();
  const nb = part.bars.length;
  const soft = softAccent(ACCENT);
  const vb = app.viewBox();
  const cap = app.barCap();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 640,
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px 11px',
          // installed on iOS the app draws under the status bar
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          borderBottom: '1px solid rgba(236,231,221,.12)',
          flex: 'none',
        }}
      >
        <button
          onClick={() => {
            app.stop();
            app.setState({ view: 'lib' });
          }}
          aria-label="Library"
          style={{
            width: 40,
            height: 40,
            border: '1px solid rgba(236,231,221,.16)',
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            flex: 'none',
          }}
        >
          ☰
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={p.title}
            onChange={(e) => {
              const v = e.target.value;
              // coalesced so a typed title is one undo step, not one per keystroke
              app.edit((pp) => void (pp.title = v), undefined, 'title');
            }}
            placeholder="Untitled groove"
            style={{
              width: '100%',
              background: 'none',
              border: 0,
              outline: 'none',
              font: '500 18px/1.2 Helvetica Neue,Helvetica,sans-serif',
              letterSpacing: '-.015em',
              padding: 0,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: ACCENT,
                display: 'inline-block',
                flex: 'none',
              }}
            />
            <span
              style={{
                font: '400 9px IBM Plex Mono,monospace',
                letterSpacing: '.06em',
                color: 'rgba(236,231,221,.45)',
                whiteSpace: 'nowrap',
              }}
            >
              {nb + (nb === 1 ? ' BAR' : ' BARS')} ·{' '}
              {p.parts.length + ' PART' + (p.parts.length === 1 ? '' : 'S')} · SAVED
            </span>
          </div>
        </div>
        <button
          onClick={() =>
            app.setState({ view: 'play' }, () => {
              if (app.state.playing) app.enterPlayWake();
            })
          }
          style={{
            height: 40,
            padding: '0 13px',
            background: '#ece7dd',
            color: '#0d0d10',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            font: '600 10px IBM Plex Mono,monospace',
            letterSpacing: '.08em',
            flex: 'none',
          }}
        >
          PLAY ⤢
        </button>
      </div>

      <Transport app={app} />

      {st.met && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '7px 16px 8px',
            borderBottom: '1px solid rgba(236,231,221,.12)',
            flex: 'none',
          }}
        >
          <span
            style={{
              font: '600 8.5px IBM Plex Mono,monospace',
              letterSpacing: '.14em',
              color: 'rgba(236,231,221,.4)',
              flex: 'none',
            }}
          >
            CLICK VOL
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={st.metVol}
            onChange={(e) => app.setState({ metVol: Number(e.target.value) })}
            style={{ flex: 1, minWidth: 0, accentColor: ACCENT }}
          />
          <span
            style={{
              font: '500 10px IBM Plex Mono,monospace',
              color: 'rgba(236,231,221,.6)',
              minWidth: 30,
              textAlign: 'right',
              flex: 'none',
            }}
          >
            {st.metVol}
          </span>
        </div>
      )}

      <PartsStrip app={app} />

      {/* notation pane — the only thing on this screen that scrolls */}
      <div
        ref={app.setPane}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          background: '#111116',
          padding: '12px 12px 4px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {part.bars.map((bar, i) => {
          const render = buildBar(bar, {
            hot: st.cur && st.cur.barId === bar.id ? st.cur.s : -1,
            drag: st.drag,
            selId: sn && st.sel && st.sel.barId === bar.id ? sn.id : null,
            acc: ACCENT,
            softAcc: soft,
            loop: st.loop,
            showBeats: SHOW_BEAT_NUMBERS,
            play: false,
            prev: i > 0 ? part.bars[i - 1] : null,
            gi: i,
          });
          const subInfo = SUBS.find((s) => s.s === bar.sub) || SUBS[0];
          const selected = st.bar === i;
          return (
            <div key={bar.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 1 }}>
                <button
                  onClick={() => app.setState({ bar: i })}
                  style={{
                    height: 24,
                    padding: '0 9px',
                    borderRadius: 6,
                    display: 'grid',
                    placeItems: 'center',
                    font: '600 9px IBM Plex Mono,monospace',
                    letterSpacing: '.1em',
                    background: selected ? '#ece7dd' : '#1c1c22',
                    color: selected ? '#0d0d10' : 'rgba(236,231,221,.6)',
                  }}
                >
                  BAR {i + 1}
                </button>
                <button
                  onClick={() => app.setState({ sheet: { k: 'sig', barId: bar.id } })}
                  style={{
                    height: 24,
                    padding: '0 9px',
                    borderRadius: 6,
                    background: '#1c1c22',
                    display: 'grid',
                    placeItems: 'center',
                    font: '500 9.5px IBM Plex Mono,monospace',
                    color: 'rgba(236,231,221,.6)',
                  }}
                >
                  {bar.n}/{bar.dv}
                </button>
                <button
                  onClick={() => app.cycleSub(bar.id)}
                  style={{
                    height: 24,
                    padding: '0 10px',
                    borderRadius: 6,
                    background: '#1c1c22',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <svg
                    width="21"
                    height="15"
                    viewBox="0 0 21 15"
                    style={{ display: 'block', flex: 'none' }}
                  >
                    <text
                      x="0.6"
                      y="14.2"
                      fontFamily="Noto Music"
                      fontSize="14"
                      fill="rgba(236,231,221,.8)"
                    >
                      {subInfo.g}
                    </text>
                  </svg>
                  <span
                    style={{
                      font: '500 8.5px IBM Plex Mono,monospace',
                      letterSpacing: '.08em',
                      color: 'rgba(236,231,221,.45)',
                    }}
                  >
                    {subInfo.t}
                  </span>
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => app.setState({ sheet: { k: 'bar', idx: i, barId: bar.id } })}
                  aria-label="Bar menu"
                  style={{
                    height: 24,
                    width: 28,
                    borderRadius: 6,
                    background: '#1c1c22',
                    display: 'grid',
                    placeItems: 'center',
                    font: '500 11px IBM Plex Mono,monospace',
                    color: 'rgba(236,231,221,.5)',
                  }}
                >
                  ⋯
                </button>
              </div>
              <Staff
                b={render}
                vb={vb}
                acc={ACCENT}
                labels={st.labels}
                maxHeight={cap}
                onPointerDown={(e) => app.onDown(bar, e)}
                onPointerMove={(e) => app.onMove(bar, e)}
                onPointerUp={(e) => app.onUp(bar, e)}
                onPointerCancel={app.onCancel}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          );
        })}
      </div>

      <Palette app={app} />
    </div>
  );
}
