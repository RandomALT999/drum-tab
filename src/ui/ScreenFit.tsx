import { useEffect, useState } from 'react';
import type { App } from '../App';
import { ACCENT } from '../config';
import { MAX_EXTRA, readExtra } from '../model/band';

/** How far back up from the viewport's edge to stripe, so the scale reads. */
const BACK = 70;

/**
 * Finds out whether the screen carries on below the app's viewport.
 *
 * The palette is the last child of a box exactly the viewport tall, so it
 * always ends flush with the viewport's bottom edge. If that edge is not the
 * screen's, iOS has handed the page a viewport shorter than the web view —
 * `black-translucent` is known to — and the difference is a strip along the
 * bottom that no percentage height reaches.
 *
 * Script cannot ask whether that strip is painted, so the eye answers: stripes
 * run past the edge, and the marker is driven from a slider up here rather than
 * by touching down there. That distinction is the whole point — anything below
 * the viewport may render without ever receiving a touch, so a control placed
 * in the region under test cannot be used to measure it.
 */
export function ScreenFit({ app, onClose }: { app: App; onClose: () => void }) {
  const [vh, setVh] = useState(0);
  const [extra, setExtra] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVh(window.innerHeight);
    setExtra(readExtra());
  }, []);

  const screenH = Math.max(screen.height || 0, screen.width || 0);
  const unused = Math.max(0, screenH - vh);
  const top = Math.min(MAX_EXTRA, unused || MAX_EXTRA);
  const set = (n: number): void => {
    setExtra(Math.max(0, Math.min(top, Math.round(n))));
    setSaved(false);
  };

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
        height: 44,
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

  const ticks: React.ReactNode[] = [];
  for (let d = -BACK + (BACK % 10); d <= MAX_EXTRA; d += 10) {
    const major = d % 20 === 0;
    ticks.push(
      <div
        key={d}
        style={{
          position: 'fixed',
          top: vh + d,
          left: 0,
          height: 1,
          width: major ? 34 : 18,
          background: '#0d0d10',
          pointerEvents: 'none',
        }}
      />,
    );
    if (major)
      ticks.push(
        <div
          key={'l' + d}
          style={{
            position: 'fixed',
            top: vh + d - 7,
            left: 40,
            font: '700 11px/1 IBM Plex Mono,monospace',
            color: '#0d0d10',
            background: '#ece7dd',
            padding: '2px 3px',
            pointerEvents: 'none',
          }}
        >
          {d > 0 ? '+' + d : d}
        </div>,
      );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0d0d10' }}>
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
          Stripes run past the bottom of the app's viewport, marked by the blue
          line. Slide until the orange line sits on the last stripe you can
          actually see — push it too far and it will vanish off the screen. Then
          save. If the orange line disappears the moment you leave 0, nothing
          down there is being drawn: save 0 and tell me.
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
          {row('UNUSED', unused + 'px')}
          {row('EXTRA', extra + 'px', true)}
        </div>

        <input
          type="range"
          min={0}
          max={top}
          step={1}
          value={extra}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="Extra height"
          style={{ width: '100%', accentColor: ACCENT }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          {btn('− 2', () => set(extra - 2))}
          {btn('+ 2', () => set(extra + 2))}
          {btn('ALL ' + top, () => set(top))}
          {btn('NONE', () => set(0))}
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
          {btn('CLOSE', onClose)}
        </div>

        <div
          style={{
            font: '400 10.5px/1.6 IBM Plex Mono,monospace',
            color: 'rgba(236,231,221,.3)',
          }}
        >
          If saving pushes the note buttons off the screen, the space was not
          real: come back here from ☰ — the top of the app never moves — and set
          NONE.
        </div>
      </div>

      {/* the pattern under test, running past the bottom edge of the viewport */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: vh - BACK,
          height: BACK + MAX_EXTRA,
          background: 'repeating-linear-gradient(to bottom,#ece7dd 0 2px,#0d0d10 2px 4px)',
          pointerEvents: 'none',
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

      {/* the reading */}
      <div
        style={{
          position: 'fixed',
          top: vh + extra - 2,
          left: 0,
          right: 0,
          height: 4,
          background: ACCENT,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: vh + extra + 6,
          right: 8,
          font: '700 11px/1 IBM Plex Mono,monospace',
          letterSpacing: '.08em',
          color: '#0d0d10',
          background: ACCENT,
          padding: '3px 5px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        +{extra}
      </div>
    </div>
  );
}
