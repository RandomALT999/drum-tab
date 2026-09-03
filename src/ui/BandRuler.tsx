import { useEffect, useRef, useState } from 'react';
import type { App } from '../App';
import { ACCENT } from '../config';
import { DEFAULT_FADE, MAX_FADE, readFade } from '../model/band';

/** How far down the page the ruler reaches. Past this nothing is ever frosted. */
const H = 260;
const LABEL_EVERY = 20;

/** Resolve a length-valued custom property by measuring a probe box. */
function varPx(name: string): number {
  const el = document.createElement('div');
  el.style.cssText =
    'position:absolute;top:0;left:0;width:1px;visibility:hidden;pointer-events:none;' +
    `height:var(${name},0px)`;
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return Math.round(h);
}

/**
 * Measures, by eye, how deep iOS's status-bar effect reaches into the page.
 *
 * Script cannot see this: the blur is composited by the system on top of the
 * web view, so nothing the page reads back has been touched by it. What the
 * page can do is put something up there that blur destroys — a fine stripe
 * pattern, which smears to flat grey the moment it is reached — and let the
 * boundary be read off a scale beside it.
 */
export function BandRuler({ app, onClose }: { app: App; onClose: () => void }) {
  const [band, setBand] = useState(0);
  const [mark, setMark] = useState(0);
  const [saved, setSaved] = useState(false);
  const ruler = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const top = varPx('--band-top');
    setBand(top);
    setMark(top + readFade());
  }, []);

  const clearance = Math.max(0, mark - band);

  const put = (clientY: number): void => {
    const r = ruler.current?.getBoundingClientRect();
    if (!r) return;
    setMark(Math.max(0, Math.min(H, Math.round(clientY - r.top))));
    setSaved(false);
  };

  const ticks: React.ReactNode[] = [];
  for (let y = 0; y <= H; y += 10) {
    const major = y % LABEL_EVERY === 0;
    ticks.push(
      <div
        key={y}
        style={{
          position: 'absolute',
          top: y,
          right: 0,
          height: 1,
          width: major ? 30 : 16,
          background: 'rgba(236,231,221,.85)',
        }}
      />,
    );
    if (major && y > 0)
      ticks.push(
        <div
          key={'l' + y}
          style={{
            position: 'absolute',
            top: y - 6,
            right: 34,
            font: '600 10px/1 IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.9)',
          }}
        >
          {y}
        </div>,
      );
  }

  const row = (k: string, v: string, accent = false): React.ReactNode => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'rgba(236,231,221,.45)' }}>{k}</span>
      <span style={{ color: accent ? ACCENT : 'rgba(236,231,221,.85)' }}>{v}</span>
    </div>
  );

  const btn = (label: string, act: () => void, primary = false): React.ReactNode => (
    <button
      onClick={act}
      style={{
        flex: 1,
        height: 42,
        borderRadius: 10,
        background: primary ? ACCENT : '#22222a',
        color: primary ? '#0d0d10' : 'rgba(236,231,221,.75)',
        font: '600 10.5px IBM Plex Mono,monospace',
        letterSpacing: '.08em',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // above the status strip, so the stripes reach the very top of the page
        zIndex: 200,
        background: '#0d0d10',
        overflowY: 'auto',
      }}
    >
      {/* the pattern under test — 2px on, 2px off. Blur turns it to flat grey. */}
      <div
        ref={ruler}
        onPointerDown={(e) => put(e.clientY)}
        onPointerMove={(e) => e.buttons && put(e.clientY)}
        style={{
          position: 'relative',
          height: H,
          background: 'repeating-linear-gradient(to bottom,#ece7dd 0 2px,#0d0d10 2px 4px)',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      >
        {ticks}

        {/* where iOS's own band ends, for reference */}
        <div
          style={{
            position: 'absolute',
            top: band,
            left: 0,
            right: 0,
            height: 0,
            borderTop: '1px dashed rgb(120,190,255)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: band + 3,
            left: 6,
            font: '600 9px/1 IBM Plex Mono,monospace',
            letterSpacing: '.1em',
            color: 'rgb(120,190,255)',
            background: '#0d0d10',
            padding: '2px 4px',
          }}
        >
          BAND {band}
        </div>

        {/* the reading */}
        <div
          style={{
            position: 'absolute',
            top: mark,
            left: 0,
            right: 0,
            height: 2,
            marginTop: -1,
            background: ACCENT,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: mark + 5,
            left: 6,
            font: '600 9px/1 IBM Plex Mono,monospace',
            letterSpacing: '.1em',
            color: '#0d0d10',
            background: ACCENT,
            padding: '3px 5px',
            borderRadius: 4,
          }}
        >
          SHARP FROM {mark}
        </div>
      </div>

      <div
        style={{ padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div
          style={{
            font: '400 11.5px/1.65 IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.55)',
          }}
        >
          The stripes above are sharp everywhere iOS is leaving the page alone, and smeared
          towards flat grey everywhere its status-bar effect reaches. Drag the orange line to
          the first row of stripes you can see clearly, then save.
        </div>

        <div
          style={{
            font: '500 12px/1.9 IBM Plex Mono,monospace',
            background: '#17171c',
            borderRadius: 10,
            padding: '10px 13px',
          }}
        >
          {row('STATUS BAND', band + 'px')}
          {row('SHARP FROM', mark + 'px')}
          {row('CLEARANCE', clearance + 'px', true)}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {btn('− 2', () => {
            setMark(Math.max(0, mark - 2));
            setSaved(false);
          })}
          {btn('+ 2', () => {
            setMark(Math.min(H, mark + 2));
            setSaved(false);
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {btn(
            saved ? 'SAVED' : 'SAVE',
            () => {
              app.setFade(clearance);
              setSaved(true);
            },
            true,
          )}
          {btn('DEFAULT', () => {
            app.setFade(DEFAULT_FADE);
            setMark(band + DEFAULT_FADE);
            setSaved(true);
          })}
          {btn('CLOSE', onClose)}
        </div>

        <div
          style={{
            font: '400 10.5px/1.6 IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.3)',
          }}
        >
          Saving moves the app down by the clearance and paints that depth flat, so nothing
          legible sits where the blur lands. 0 gives the screen back and lets the top row smear
          again. Ceiling {MAX_FADE}px.
        </div>
      </div>
    </div>
  );
}
