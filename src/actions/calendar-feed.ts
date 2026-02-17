'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';

/* ━━━ Generate Calendar Token ━━━ */

export async function generateCalendarToken(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const token = randomBytes(32).toString('hex');

  const { error } = await supabase.auth.updateUser({
    data: { calendar_feed_token: token },
  });

  if (error) {
    console.error('Failed to generate calendar token:', error);
    throw new Error('Failed to generate calendar feed token');
  }

  revalidatePath('/settings');
  return token;
}

/* ━━━ Get Calendar Feed URL ━━━ */

export async function getCalendarFeedUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const token = user.user_metadata?.calendar_feed_token;
  if (!token) return null;

  // Build the feed URL from the app's origin
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.vercel.app') || 'http://localhost:3000';
  return `${baseUrl}/api/calendar/feed?token=${token}`;
}

/* ━━━ Revoke Calendar Token ━━━ */

export async function revokeCalendarToken(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.auth.updateUser({
    data: { calendar_feed_token: null },
  });

  if (error) {
    console.error('Failed to revoke calendar token:', error);
    throw new Error('Failed to revoke calendar feed token');
  }

  revalidatePath('/settings');
}
