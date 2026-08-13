import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from 'react';
import type { BarRender } from './layout';
import {
  CH,
  CLEF_FS,
  CLEF_X,
  CLEF_Y,
  LABELS,
  MUT,
  NONE,
  TSFS,
  TSX,
  TSY_DEN,
  TSY_NUM,
} from './constants';

export interface StaffProps {
  b: BarRender;
  /** viewBox string — narrows when voice labels are hidden */
  vb: string;
  acc: string;
  labels: boolean;
  maxHeight: string;
  /** right edge of the staff in user units */
  br: number;
  /** landscape: let horizontal swipes scroll past the bar */
  pannable?: boolean;
  /** Play mode: heavier strokes, no beat numbers, no selection ring */
  play?: boolean;
  onPointerDown?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: () => void;
  onContextMenu?: (e: RMouseEvent<SVGSVGElement>) => void;
}

export function Staff({
  b,
  vb,
  acc,
  labels,
  maxHeight,
  br,
  pannable = false,
  play = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
}: StaffProps) {
  const staffStroke = play ? 'rgba(236,231,221,.8)' : 'rgba(236,231,221,.7)';
  const staffW = play ? 1.2 : 1.1;
  const barStroke = play ? '#ece7dd' : 'rgba(236,231,221,.9)';
  const barW = play ? 2.1 : 2;
  const stemW = play ? 1.9 : 1.8;
  const stemHotW = play ? 2.3 : 2.2;
  const parenW = play ? 1.8 : 1.7;
  const labelFill = labels ? MUT : NONE;

  return (
    <svg
      className={play ? undefined : pannable ? 'staff pannable' : 'staff'}
      viewBox={vb}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      style={{
        width: '100%',
        height: 'auto',
        maxHeight,
        display: 'block',
        userSelect: 'none',
      }}
    >
      {/* playhead */}
      {b.hl.map((r, i) => (
        <rect key={i} x={r.x} y={14} width={r.w} height={144} rx={4} fill={r.fill} />
      ))}
      {/* selection ring */}
      {!play &&
        b.selBox.map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={26}
            height={22}
            rx={6}
            fill="none"
            stroke={acc}
            strokeWidth={1.5}
          />
        ))}

      <path
        d={`M66 60H${br}M66 76H${br}M66 92H${br}M66 108H${br}M66 124H${br}`}
        stroke={staffStroke}
        strokeWidth={staffW}
        fill="none"
      />
      <path d={`M67 60v64M${br - 1} 60v64`} stroke={barStroke} strokeWidth={barW} fill="none" />
      <path d={b.ledgers} stroke={staffStroke} strokeWidth={staffW} fill="none" />

      <text x={CLEF_X} y={CLEF_Y} fontFamily="Noto Music" fontSize={CLEF_FS} fill="#ece7dd">
        {CH.clef}
      </text>

      {b.showTS && (
        <g fontFamily="Noto Music" fontSize={TSFS} fill="#ece7dd" textAnchor="middle">
          <text x={TSX} y={TSY_NUM}>
            {b.tsNum}
          </text>
          <text x={TSX} y={TSY_DEN}>
            {b.tsDen}
          </text>
        </g>
      )}

      <g fontFamily="Noto Music" fontSize={44}>
        {b.r4.map((r, i) => (
          <text key={'a' + i} x={r.x} y={r.y} fill={r.c}>
            {CH.r4}
          </text>
        ))}
        {b.r8.map((r, i) => (
          <text key={'b' + i} x={r.x} y={r.y} fill={r.c}>
            {CH.r8}
          </text>
        ))}
        {b.r16.map((r, i) => (
          <text key={'c' + i} x={r.x} y={r.y} fill={r.c}>
            {CH.r16}
          </text>
        ))}
      </g>

      <g fontFamily="Noto Music" fontSize={60}>
        {b.nh.map((h, i) => (
          <text key={'n' + i} x={h.x} y={h.y} fill={h.c} opacity={h.op}>
            {CH.headN}
          </text>
        ))}
        {b.xh.map((h, i) => (
          <text key={'x' + i} x={h.x} y={h.y} fill={h.c} opacity={h.op}>
            {CH.headX}
          </text>
        ))}
        {b.oh.map((h, i) => (
          <text key={'o' + i} x={h.x} y={h.y} fill={h.c} opacity={h.op}>
            {CH.headO}
          </text>
        ))}
        {/* drag ghosts */}
        {!play &&
          b.gn.map((h, i) => (
            <text key={'gn' + i} x={h.x} y={h.y} fill={acc} opacity={0.55}>
              {CH.headN}
            </text>
          ))}
        {!play &&
          b.gx.map((h, i) => (
            <text key={'gx' + i} x={h.x} y={h.y} fill={acc} opacity={0.55}>
              {CH.headX}
            </text>
          ))}
      </g>

      <path d={b.stems} stroke="#ece7dd" strokeWidth={stemW} fill="none" />
      <path d={b.stemsHot} stroke={acc} strokeWidth={stemHotW} fill="none" />
      {b.beams.map((m, i) => (
        <rect key={i} x={m.x} y={m.y} width={m.w} height={6} fill={m.c} />
      ))}
      <path d={b.flags} fill="#ece7dd" />

      {b.accents.map((a, i) => (
        <path
          key={i}
          d={a.d}
          stroke={a.c}
          strokeWidth={play ? 2.3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {b.rings.map((o, i) => (
        <circle key={i} cx={o.x} cy={o.y} r={4.6} stroke={o.c} strokeWidth={1.5} fill="none" />
      ))}
      <path
        d={b.parens}
        stroke="rgba(236,231,221,.7)"
        strokeWidth={parenW}
        strokeLinecap="round"
        fill="none"
      />
      {b.trip.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={t.y}
          textAnchor="middle"
          fontFamily="Helvetica Neue,Helvetica,sans-serif"
          fontStyle="italic"
          fontWeight={600}
          fontSize={12}
          fill="rgba(236,231,221,.55)"
        >
          3
        </text>
      ))}
      {b.loop.map((l, i) => (
        <path key={i} d={l.d} stroke={acc} strokeWidth={1.6} fill="none" />
      ))}

      <g fontFamily="IBM Plex Mono,monospace" fontSize={9} textAnchor="end">
        {LABELS.map((l) => (
          <text key={l.ab} x={l.x} y={l.y} fill={labelFill}>
            {l.ab}
          </text>
        ))}
      </g>

      {!play && (
        <g fontFamily="IBM Plex Mono,monospace" fontSize={9.5} textAnchor="middle">
          {b.beats.map((t) => (
            <text key={t.n} x={t.x} y={168} fill={t.fill}>
              {t.n}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
