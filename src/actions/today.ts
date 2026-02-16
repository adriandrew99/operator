'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getToday } from '@/lib/utils/date';

export async function getOrCreateDailyObjective() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  const { data: existing } = await supabase
    .from('daily_objectives')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('daily_objectives')
    .insert({ user_id: user.id, date: today })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateDailyObjective(
  field: string,
  value: string | boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  const { error } = await supabase
    .from('daily_objectives')
    .upsert(
      { user_id: user.id, date: today, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );

  if (error) throw error;
  revalidatePath('/today');
}

export async function getOrCreateFundamentals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  const { data: existing } = await supabase
    .from('fundamentals')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('fundamentals')
    .insert({ user_id: user.id, date: today })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function toggleFundamental(field: string, value: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  const { error } = await supabase
    .from('fundamentals')
    .upsert(
      { user_id: user.id, date: today, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );

  if (error) throw error;
  revalidatePath('/today');
}

export async function saveDeepWorkSession(
  startedAt: string,
  endedAt: string,
  durationMinutes: number,
  completed: boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('deep_work_sessions')
    .insert({
      user_id: user.id,
      date: getToday(),
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      completed,
    });

  if (error) throw error;
  revalidatePath('/today');
}

export async function getTodayDeepWorkMinutes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from('deep_work_sessions')
    .select('duration_minutes')
    .eq('user_id', user.id)
    .eq('date', getToday());

  if (!data) return 0;
  return data.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
}

export async function saveOperatorScore(score: number, breakdown: object) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('operator_scores')
    .upsert(
      {
        user_id: user.id,
        date: getToday(),
        score,
        breakdown,
      },
      { onConflict: 'user_id,date' }
    );

  if (error) throw error;
}

export async function getStreakDays() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from('operator_scores')
    .select('date, score')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(30);

  if (!data || data.length === 0) return 0;

  let streak = 0;
  const today = new Date(getToday());

  for (let i = 0; i < data.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i - 1);
    const expectedStr = expectedDate.toISOString().split('T')[0];

    if (data[i].date === expectedStr && data[i].score >= 70) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
