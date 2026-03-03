import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getWebPush } from '@/lib/utils/web-push';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reminders/send
 *
 * Triggered hourly by external cron service.
 * Checks all active reminders whose hour + day matches the current time
 * in the user's timezone, then sends push notifications to their devices.
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  try {
    // Fetch all active reminders
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select('*')
      .eq('is_active', true);

    if (remindersError) throw remindersError;
    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: 'No active reminders', sent: 0 });
    }

    // Group notifications by user — check if each reminder should fire now
    const now = new Date();
    const usersToNotify = new Map<string, Array<{ title: string; body: string; url: string; tag: string }>>();

    for (const reminder of reminders) {
      // Get current time in the reminder's timezone
      const userTimeStr = now.toLocaleString('en-US', { timeZone: reminder.timezone || 'Europe/London' });
      const userNow = new Date(userTimeStr);
      const userHour = userNow.getHours();
      const userDay = userNow.getDay(); // 0=Sun..6=Sat

      if (
        (reminder.hours as number[]).includes(userHour) &&
        (reminder.days_of_week as number[]).includes(userDay)
      ) {
        const existing = usersToNotify.get(reminder.user_id) || [];
        existing.push({
          title: reminder.title,
          body: reminder.body || '',
          url: reminder.url || '/today',
          tag: reminder.tag || 'reminder',
        });
        usersToNotify.set(reminder.user_id, existing);
      }
    }

    if (usersToNotify.size === 0) {
      return NextResponse.json({ message: 'No reminders due right now', sent: 0 });
    }

    // Send push notifications to each user's devices
    let sentCount = 0;
    let errorCount = 0;

    for (const [userId, notifications] of usersToNotify) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, keys_p256dh, keys_auth')
        .eq('user_id', userId);

      if (!subscriptions || subscriptions.length === 0) continue;

      for (const notification of notifications) {
        const payload = JSON.stringify(notification);

        for (const sub of subscriptions) {
          try {
            await getWebPush().sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
              },
              payload
            );
            sentCount++;
          } catch (err: unknown) {
            errorCount++;
            const statusCode = (err as { statusCode?: number }).statusCode;
            // Clean up expired/invalid subscriptions
            if (statusCode === 410 || statusCode === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint)
                .eq('user_id', userId);
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Reminders processed',
      sent: sentCount,
      errors: errorCount,
      usersNotified: usersToNotify.size,
    });
  } catch (error) {
    console.error('Reminder cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
