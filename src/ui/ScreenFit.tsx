import { useEffect, useRef, useState } from 'react';
import type { App } from '../App';
import { ACCENT } from '../config';
import { MAX_EXTRA, readExtra } from '../model/band';

/** How far past the viewport's bottom edge to look. */
const PROBE = 200;
/** And how far back up, so the scale can be read against known-good screen. */
const BACK = 70;

/**
 * Finds out whether the screen carries on below the app's viewport.
 *
 * The palette is the last child of a box that is exactly the viewport tall, so
 * it always ends flush with the viewport's bottom edge. If that edge is not the
 * screen's, iOS has handed the page a viewport shorter than the web view —
 * `black-translucent` is known to — and the difference is a strip along the
 * bottom no percentage height can reach.
 *
 * Script cannot ask whether that strip is painted. So this draws stripes past
 * the edge and lets the eye answer: stripes still visible below the line are
 * screen the app could be using, and the reading is how much.
 */
export function ScreenFit({ app, onClose }: { app: App; onClose: () => void }) {
  const [vh, setVh] = useState(0);
  const [mark, setMark] = useState(0);
  const [saved, setSaved] = useState(false);
  const strip = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = window.innerHeight;
    setVh(h);
    setMark(h + readExtra());
  }, []);

  const extra = Math.max(0, Math.min(MAX_EXTRA, mark - vh));
  const screenH = Math.max(screen.height || 0, screen.width || 0);
  const diff = Math.max(0, screenH - vh);

  const put = (clientY: number): void => {
    const r = strip.current?.getBoundingClientRect();
    if (!r) return;
    setMark(Math.max(vh - BACK, Math.min(vh + PROBE, Math.round(clientY))));
    setSaved(false);
  };

  const ticks: React.ReactNode[] = [];
  for (let d = -BACK + (BACK % 10); d <= PROBE; d += 10) {
    const major = d % 20 === 0;
    ticks.push(
      <div
        key={d}
        style={{
          position: 'fixed',
          top: vh + d,
          right: 0,
          height: 1,
          width: major ? 30 : 16,
          background: 'rgba(236,231,221,.85)',
        }}
      />,
    );
    if (major)
      ticks.push(
        <div
          key={'l' + d}
          style={{
            position: 'fixed',
            top: vh + d - 6,
            right: 34,
            font: '600 10px/1 IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.9)',
          }}
        >
          {d > 0 ? '+' + d : d}
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0d0d10' }}>
      {/* Controls live at the top: the bottom of the screen is what is on test. */}
      <div
        style={{
          padding: 'calc(var(--band) + 12px) 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
        }}
      >
        <div
          style={{
            font: '400 11.5px/1.65 IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.55)',
          }}
        >
          The orange line is where the app's viewport ends. Stripes you can still
          see below it are screen the app is not using yet. Drag the line down to
          the last stripe you can see and save. If there is nothing below the
          line but blank screen, save 0 — that space is unreachable and the fix
          is a different one.
        </div>

        <div
          style={{
            font: '500 12px/1.9 IBM Plex Mono,monospace',
            background: '#17171c',
            borderRadius: 10,
            padding: '10px 13px',
          }}
        >
          {row('SCREEN', screenH + 'px')}
          {row('VIEWPORT', vh + 'px')}
          {row('UNUSED', diff + 'px')}
          {row('EXTRA', extra + 'px', true)}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {btn('− 2', () => {
            setMark(Math.max(vh - BACK, mark - 2));
            setSaved(false);
          })}
          {btn('+ 2', () => {
            setMark(Math.min(vh + PROBE, mark + 2));
            setSaved(false);
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {btn(
            saved ? 'SAVED' : 'SAVE',
            () => {
              app.setExtra(extra);
              setSaved(true);
            },
            true,
          )}
          {btn('RESET', () => {
            app.setExtra(0);
            setMark(vh);
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
          If saving pushes the note buttons off the screen, the space was not
          real: come back here from ☰ — the top of the app never moves — and
          press RESET. Ceiling {MAX_EXTRA}px.
        </div>
      </div>

      {/* the pattern under test, running past the bottom edge of the viewport */}
      <div
        ref={strip}
        onPointerDown={(e) => put(e.clientY)}
        onPointerMove={(e) => e.buttons && put(e.clientY)}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: vh - BACK,
          height: BACK + PROBE,
          background: 'repeating-linear-gradient(to bottom,#ece7dd 0 2px,#0d0d10 2px 4px)',
          touchAction: 'none',
        }}
      />
      {ticks}

      {/* where the viewport stops */}
      <div
        style={{
          position: 'fixed',
          top: vh - 1,
          left: 0,
          right: 0,
          height: 2,
          background: 'rgb(120,190,255)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: vh - 20,
          left: 6,
          font: '600 9px/1 IBM Plex Mono,monospace',
          letterSpacing: '.1em',
          color: '#0d0d10',
          background: 'rgb(120,190,255)',
          padding: '3px 5px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        VIEWPORT ENDS
      </div>

      {/* the reading */}
      <div
        style={{
          position: 'fixed',
          top: mark - 1,
          left: 0,
          right: 0,
          height: 2,
          background: ACCENT,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: mark + 5,
          left: 6,
          font: '600 9px/1 IBM Plex Mono,monospace',
          letterSpacing: '.1em',
          color: '#0d0d10',
          background: ACCENT,
          padding: '3px 5px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        SEEN TO {mark - vh > 0 ? '+' + (mark - vh) : mark - vh}
      </div>
    </div>
  );
}
