import type { App } from '../App';
import { ACCENT, SHOW_BEAT_NUMBERS, softAccent } from '../config';
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
  const { width: barW, cap } = app.barLayout();
  // hoisted: br() scans the whole part, so it must not run once per bar
  const br = app.br();
  // one lookup for the whole part, not one per bar
  const loop = app.loopRange(part.bars);
  const compact = st.compact;

  return (
    <div
      className="screen"
      style={{
        width: '100%',
        // Landscape is still the editor — it just gets more room. Widening the
        // column and trimming the chrome is what "rescale to fit" means here.
        maxWidth: compact ? 1180 : 640,
        display: 'flex',
        flexDirection: 'column',
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
          padding: compact ? '6px 12px 6px' : '10px 12px 9px',
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
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
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
              font: `500 ${compact ? 16 : 19}px/1.2 Helvetica Neue,Helvetica,sans-serif`,
              letterSpacing: '-.015em',
              padding: 0,
            }}
          />
          {/* the save/meta line is the first thing to go when height is scarce */}
          <div
            style={{
              display: compact ? 'none' : 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 3,
            }}
          >
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
                font: '400 9.5px IBM Plex Mono,monospace',
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
            height: compact ? 32 : 40,
            padding: '0 13px',
            background: '#ece7dd',
            color: '#0d0d10',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            font: '600 11px IBM Plex Mono,monospace',
            letterSpacing: '.06em',
            flex: 'none',
          }}
        >
          PLAY ⤢
        </button>
      </div>

      {compact ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 'none',
            borderBottom: '1px solid rgba(236,231,221,.12)',
          }}
        >
          <Transport app={app} />
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <PartsStrip app={app} />
          </div>
        </div>
      ) : (
        <Transport app={app} />
      )}

      {st.met && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: compact ? '3px 16px 4px' : '7px 16px 8px',
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

      {!compact && <PartsStrip app={app} />}

      {/* notation pane — the only thing on this screen that scrolls */}
      <div
        className="pane"
        ref={app.setPane}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          background: '#111116',
          padding: compact ? '6px 0 4px' : '10px 12px 6px',
          overflowY: compact ? 'hidden' : 'auto',
          overflowX: compact ? 'auto' : 'hidden',
          display: 'flex',
          flexWrap: compact ? 'nowrap' : 'wrap',
          alignContent: 'flex-start',
          gap: compact ? '0' : '8px 14px',
          scrollSnapType: compact ? 'x mandatory' : undefined,
        }}
      >
        {part.bars.map((bar, i) => {
          const render = buildBar(bar, {
            hot: st.cur && st.cur.barId === bar.id ? st.cur.s : -1,
            drag: st.drag,
            selId: sn && st.sel && st.sel.barId === bar.id ? sn.id : null,
            acc: ACCENT,
            softAcc: soft,
            loop,
            showBeats: !compact && SHOW_BEAT_NUMBERS,
            play: false,
            prev: i > 0 ? part.bars[i - 1] : null,
            gi: i,
            br,
          });
          const selected = st.bar === i;
          return (
            <div
              key={bar.id}
              // auto-scroll needs to find this bar's box while playing
              ref={(el) => {
                if (el) app.barEls[bar.id] = el;
              }}
              style={{
                width: barW,
                flex: 'none',
                scrollSnapAlign: compact ? 'start' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <button
                  onClick={() => app.setState({ bar: i })}
                  style={{
                    height: 28,
                    padding: '0 11px',
                    borderRadius: 7,
                    display: 'grid',
                    placeItems: 'center',
                    font: '600 10px IBM Plex Mono,monospace',
                    letterSpacing: '.08em',
                    background: selected ? '#ece7dd' : '#1c1c22',
                    color: selected ? '#0d0d10' : 'rgba(236,231,221,.6)',
                  }}
                >
                  BAR {i + 1}
                </button>
                <button
                  onClick={() => app.setState({ sheet: { k: 'sig', barId: bar.id } })}
                  style={{
                    height: 28,
                    padding: '0 11px',
                    borderRadius: 7,
                    background: '#1c1c22',
                    display: 'grid',
                    placeItems: 'center',
                    font: '500 10.5px IBM Plex Mono,monospace',
                    color: 'rgba(236,231,221,.6)',
                  }}
                >
                  {bar.n}/{bar.dv}
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => app.setState({ sheet: { k: 'bar', idx: i, barId: bar.id } })}
                  aria-label="Bar menu"
                  style={{
                    height: 28,
                    width: 32,
                    borderRadius: 7,
                    background: '#1c1c22',
                    display: 'grid',
                    placeItems: 'center',
                    font: '500 13px IBM Plex Mono,monospace',
                    color: 'rgba(236,231,221,.55)',
                  }}
                >
                  ⋯
                </button>
              </div>
              <Staff
                br={br}
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
