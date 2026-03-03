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

/**
 * Subscribe to server push notifications via PushManager.
 * Returns the PushSubscription JSON to send to the server, or null if failed.
 */
export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const permission = await requestNotificationPermission();
  if (!permission) return null;

  const registration = await navigator.serviceWorker.ready;

  // Check for existing subscription first
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID public key not configured');
      return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer;

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  return subscription.toJSON();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
