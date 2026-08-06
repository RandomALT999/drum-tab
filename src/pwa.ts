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
    onNeedRefresh() {
      listener?.();
    },
  });
}
