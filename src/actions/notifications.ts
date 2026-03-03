'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PushSubscriptionRecord, Reminder } from '@/lib/types/database';

// ━━━ Push Subscriptions ━━━

export async function savePushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
      user_agent: subscription.userAgent || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

  if (error) return { success: false, error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) return { success: false, error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function getPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (data as PushSubscriptionRecord[]) || [];
}

export async function sendTestPush(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', user.id);

  if (!subscriptions || subscriptions.length === 0) {
    return { success: false, error: 'No push subscriptions found. Enable push first.' };
  }

  // Dynamic import to avoid loading web-push on client
  const { getWebPush } = await import('@/lib/utils/web-push');
  const webpush = getWebPush();

  const payload = JSON.stringify({
    title: 'Nexus',
    body: 'Push notifications are working!',
    tag: 'test-push',
    url: '/today',
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // Clean up expired subscriptions
      if (statusCode === 410 || statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
          .eq('user_id', user.id);
      }
    }
  }

  if (sent === 0) return { success: false, error: 'All subscriptions expired. Re-enable push.' };
  return { success: true };
}

// ━━━ Reminders CRUD ━━━

export async function getReminders(): Promise<Reminder[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('reminders')
    .select('*, clients(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (!data) return [];

  // Flatten the joined client name
  return data.map((r: Record<string, unknown>) => {
    const clientName = (r.clients as { name: string } | null)?.name || undefined;
    const { clients: _clients, ...rest } = r;
    return { ...rest, client_name: clientName } as unknown as Reminder;
  });
}

export async function createReminder(reminder: {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  hours: number[];
  days_of_week?: number[];
  timezone?: string;
  client_id?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('reminders')
    .insert({
      user_id: user.id,
      client_id: reminder.client_id || null,
      title: reminder.title,
      body: reminder.body || null,
      url: reminder.url || '/today',
      tag: reminder.tag || 'reminder',
      hours: reminder.hours,
      days_of_week: reminder.days_of_week || [1, 2, 3, 4, 5],
      timezone: reminder.timezone || 'Europe/London',
    });

  if (error) return { success: false, error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function updateReminder(id: string, updates: Partial<{
  title: string;
  body: string | null;
  url: string;
  tag: string;
  hours: number[];
  days_of_week: number[];
  timezone: string;
  is_active: boolean;
}>): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('reminders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function deleteReminder(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath('/settings');
  return { success: true };
}
