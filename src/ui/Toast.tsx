export interface ToastProps {
  text: string;
  /** The service-worker update toast is tappable; the normal one is not. */
  interactive?: boolean;
  onClick?: () => void;
}

export function Toast({ text, interactive = false, onClick }: ToastProps) {
  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 170,
        transform: 'translateX(-50%)',
        background: '#ece7dd',
        color: '#0d0d10',
        padding: '9px 15px',
        borderRadius: 20,
        font: '600 10.5px IBM Plex Mono,monospace',
        letterSpacing: '.06em',
        zIndex: 50,
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}
