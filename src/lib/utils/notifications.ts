/**
 * Notification utilities for Nexus PWA.
 *
 * Uses the service worker to show notifications even when the app
 * is in the background. Falls back to the Notification API directly
 * if the SW isn't available.
 */

/** Check if notifications are supported and permitted */
export function canNotify(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/** Request notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Send a notification via the service worker (or fallback to direct Notification API) */
export async function sendNotification(options: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}) {
  if (!canNotify()) return;

  // Try to send via service worker (works in background)
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'SHOW_NOTIFICATION',
        ...options,
      });
      return;
    }
  }

  // Fallback: direct Notification API (only works when tab is open)
  new Notification(options.title, {
    body: options.body,
    icon: '/icons/icon-192x192.png',
    tag: options.tag || 'nexus-notification',
  });
}
