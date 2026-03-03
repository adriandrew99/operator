import webpush from 'web-push';

let configured = false;

/**
 * Returns the web-push instance with VAPID details configured.
 * Lazy initialization avoids running setVapidDetails at build time.
 */
export function getWebPush() {
  if (!configured) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      throw new Error('VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:hello@operator.so',
      publicKey,
      privateKey
    );
    configured = true;
  }

  return webpush;
}
