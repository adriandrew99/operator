'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { DashboardLayoutPreferences } from '@/lib/types/dashboard-layout';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/lib/types/dashboard-layout';

export async function updateMLUCapacity(capacity: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ daily_mlu_capacity: capacity })
    .eq('id', user.id);

  // Silently ignore if column doesn't exist yet (migration not run)
  if (error && !error.message?.includes('daily_mlu_capacity')) throw error;

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/planner');
}

export async function updateWorkSchedule(updates: {
  work_start_hour?: number;
  work_end_hour?: number;
  work_days?: number[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  // Silently ignore if columns don't exist yet (migration not run)
  if (error) console.error('updateWorkSchedule error (migration may not be run):', error.message);
  revalidatePath('/settings');
  revalidatePath('/today');
}

export async function updateFinanceSettings(updates: {
  monthly_salary?: number;
  staff_cost?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  // Silently ignore if columns don't exist yet (migration not run)
  if (error) console.error('updateFinanceSettings error (migration may not be run):', error.message);
  revalidatePath('/settings');
  revalidatePath('/finance');
}

export async function saveDashboardLayout(layout: DashboardLayoutPreferences) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.auth.updateUser({
    data: { dashboard_layout: layout },
  });

  if (error) {
    console.error('Failed to save dashboard layout:', error);
    throw new Error('Failed to save dashboard layout');
  }

  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/analytics');
}

export async function getDashboardLayout(): Promise<DashboardLayoutPreferences> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_DASHBOARD_LAYOUT;

  const stored = user.user_metadata?.dashboard_layout;
  if (stored && typeof stored === 'object') {
    return {
      today: { ...DEFAULT_DASHBOARD_LAYOUT.today, ...stored.today },
      analytics: { ...DEFAULT_DASHBOARD_LAYOUT.analytics, ...stored.analytics },
    };
  }

  return DEFAULT_DASHBOARD_LAYOUT;
}
