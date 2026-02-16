'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Don't register in Tauri desktop app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__TAURI_INTERNALS__) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  }, []);

  return null;
}
