'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getToday } from '@/lib/utils/date';
import { DEFAULT_FUNDAMENTALS } from '@/lib/constants';
import { recalculateAutoScore } from '@/actions/score';

export async function getCustomFundamentals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('custom_fundamentals')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  // If user has no custom fundamentals yet, seed with defaults
  if (!data || data.length === 0) {
    const defaults = DEFAULT_FUNDAMENTALS.map((f, i) => ({
      user_id: user.id,
      label: f.label,
      icon: f.icon,
      sort_order: i,
    }));

    const { data: seeded, error: seedError } = await supabase
      .from('custom_fundamentals')
      .insert(defaults)
      .select();

    if (seedError) throw seedError;
    return seeded;
  }

  return data;
}

export async function createCustomFundamental(label: string, icon?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('custom_fundamentals')
    .insert({ user_id: user.id, label, icon: icon || '✓' });

  if (error) throw error;
  revalidatePath('/settings');
}

export async function updateCustomFundamental(id: string, updates: { label?: string; icon?: string; sort_order?: number }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('custom_fundamentals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/settings');
}

export async function deleteCustomFundamental(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('custom_fundamentals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/settings');
}

export async function getTodayCompletions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('fundamental_completions')
    .select('fundamental_id, completed')
    .eq('user_id', user.id)
    .eq('date', getToday());

  if (error) throw error;
  return data || [];
}

export async function toggleFundamentalCompletion(fundamentalId: string, completed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  if (completed) {
    const { error } = await supabase
      .from('fundamental_completions')
      .upsert(
        { user_id: user.id, fundamental_id: fundamentalId, date: today, completed: true },
        { onConflict: 'fundamental_id,date' }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('fundamental_completions')
      .delete()
      .eq('fundamental_id', fundamentalId)
      .eq('date', today)
      .eq('user_id', user.id);
    if (error) throw error;
  }

  revalidatePath('/today');
  revalidatePath('/score');

  // Recalculate operator score with updated fundamental metrics
  recalculateAutoScore().catch(() => {});
}
