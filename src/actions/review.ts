'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getWeekStart } from '@/lib/utils/date';

export async function getOrCreateWeeklyReview(weekStart?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const week = weekStart || getWeekStart();

  const { data: existing } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', week)
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('weekly_reviews')
    .insert({ user_id: user.id, week_start: week })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateWeeklyReview(field: string, value: string | number | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const week = getWeekStart();

  const { error } = await supabase
    .from('weekly_reviews')
    .upsert(
      {
        user_id: user.id,
        week_start: week,
        [field]: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start' }
    );

  if (error) throw error;
  revalidatePath('/review');
}

export async function getReviewHistory() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(12);

  if (error) throw error;
  return data;
}

export async function getOperatorScoreHistory(weeks: number = 8) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('operator_scores')
    .select('date, score')
    .eq('user_id', user.id)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw error;
  return data;
}
