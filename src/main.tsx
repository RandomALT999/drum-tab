import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initPWA } from './pwa';
import './styles.css';

// Standalone has no auto-hiding toolbars, so the shell can size to the web
// view directly rather than chasing the dynamic viewport.
const nav = navigator as Navigator & { standalone?: boolean };
if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone)
  document.documentElement.dataset.standalone = '1';

initPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
