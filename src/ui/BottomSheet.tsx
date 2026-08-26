import { SAFE_BOTTOM } from '../config';

export interface SheetItem {
  /** glyph */
  g: string;
  /** label */
  t: string;
  act: () => void;
  flex?: string;
  min?: string;
  bg?: string;
  fg?: string;
  ff?: string;
  fs?: string;
  dy?: string;
}

export interface SheetSpec {
  title: string;
  close: () => void;
  input?: { val: string; onChange: (v: string) => void; numeric?: boolean };
  items: SheetItem[];
}

/** One shared modal shell for every secondary action. */
export function BottomSheet({ spec }: { spec: SheetSpec }) {
  return (
    <div
      onClick={spec.close}
      style={{
        position: 'fixed',
        // stops short of the status band: a translucent box at the top edge is
        // what iOS samples to decide the band should be frosted glass
        top: 'env(safe-area-inset-top, 0px)',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,.62)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#17171c',
          borderRadius: '18px 18px 0 0',
          padding: '16px 16px 22px',
          paddingBottom: `calc(14px + ${SAFE_BOTTOM})`,
          animation: 'rise .16s ease-out',
        }}
      >
        <div
          style={{
            font: '600 9px IBM Plex Mono,monospace',
            letterSpacing: '.16em',
            color: 'rgba(236,231,221,.4)',
            marginBottom: 12,
          }}
        >
          {spec.title}
        </div>
        {spec.input && (
          <input
            value={spec.input.val}
            inputMode={spec.input.numeric ? 'numeric' : undefined}
            onChange={(e) => spec.input!.onChange(e.target.value)}
            style={{
              width: '100%',
              height: 46,
              background: '#0d0d10',
              border: '1px solid rgba(236,231,221,.16)',
              borderRadius: 10,
              padding: '0 13px',
              outline: 'none',
              font: '500 15px Helvetica Neue,Helvetica,sans-serif',
              marginBottom: 10,
            }}
          />
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {spec.items.map((it, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                it.act();
              }}
              style={{
                flex: it.flex || '1',
                minWidth: it.min || '112px',
                height: 52,
                borderRadius: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                cursor: 'pointer',
                background: it.bg || '#22222a',
                color: it.fg || '#ece7dd',
              }}
            >
              <span
                style={{
                  fontFamily: it.ff || 'Noto Music',
                  fontSize: it.fs || '26px',
                  lineHeight: 1,
                  transform: `translateY(${it.dy || '5px'})`,
                }}
              >
                {it.g}
              </span>
              {it.t && (
                <span
                  style={{
                    font: '600 10.5px IBM Plex Mono,monospace',
                    letterSpacing: '.06em',
                  }}
                >
                  {it.t}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
