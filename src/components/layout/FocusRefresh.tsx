'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Refreshes server data when the tab/app regains focus.
 * Fixes cross-device sync: if you complete a task on desktop,
 * the phone PWA will pick up the change when you switch back to it.
 *
 * Debounced to max once per 30 seconds to avoid hammering the server.
 */
export function FocusRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefresh = Date.now();
    const DEBOUNCE_MS = 30_000; // 30 seconds

    function handleFocus() {
      const now = Date.now();
      if (now - lastRefresh < DEBOUNCE_MS) return;
      lastRefresh = now;
      router.refresh();
    }

    // Tab visibility change (mobile browser / PWA)
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router]);

  return null;
}
