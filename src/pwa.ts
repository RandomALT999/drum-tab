import { registerSW } from 'virtual:pwa-register';

let listener: (() => void) | null = null;
let update: ((reload?: boolean) => Promise<void>) | null = null;

/** Called by App once mounted, so the update toast can be shown in-app. */
export function onUpdateReady(fn: () => void): void {
  listener = fn;
}

/** Activates the waiting service worker and reloads. */
export function applyUpdate(): void {
  void update?.(true);
}

export function initPWA(): void {
  update = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      if (!r) return;
      // A Home Screen app on iOS is suspended, not closed, so it can go days
      // without ever asking whether there is a newer build. Ask on every
      // return to the foreground.
      const check = (): void => {
        if (document.visibilityState === 'visible') void r.update();
      };
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
      setInterval(check, 30 * 60 * 1000);
    },
    onNeedRefresh() {
      listener?.();
    },
  });
}
