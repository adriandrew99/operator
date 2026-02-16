'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getToday } from '@/lib/utils/date';

export async function getRecurringTasks() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('recurring_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getTodayCompletions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('recurring_task_completions')
    .select('recurring_task_id')
    .eq('user_id', user.id)
    .eq('date', getToday());

  if (error) throw error;
  return data?.map((c) => c.recurring_task_id) || [];
}

export async function createRecurringTask(taskData: {
  title: string;
  description?: string;
  category?: string;
  frequency?: string;
  day_of_week?: number;
  days_of_week?: number[];
  scheduled_time?: string;
  client_id?: string;
  weight?: string;
  energy?: string;
  estimated_minutes?: number;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Strip empty strings and undefined values that could reference missing columns
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(taskData)) {
    if (value !== undefined && value !== '' && value !== null) {
      cleanData[key] = value;
    }
  }

  // Remove columns that may not exist if migrations haven't been run
  const insertData: Record<string, unknown> = {
    user_id: user.id,
    is_active: true,
    sort_order: 0,
    ...cleanData,
  };

  let { error } = await supabase
    .from('recurring_tasks')
    .insert(insertData);

  // If client_id column doesn't exist yet (migration 00007 not run), retry without it
  if (error && (error.message?.includes('client_id') || error.message?.includes('schema cache'))) {
    delete insertData.client_id;
    delete insertData.weight;
    delete insertData.energy;
    delete insertData.estimated_minutes;
    const retry = await supabase.from('recurring_tasks').insert(insertData);
    error = retry.error;
  }

  // Auto-retry with 'personal' category if 'admin' was rejected by old DB constraint
  if (error && (error.code === '23514' || error.message?.includes('category'))) {
    if (insertData.category === 'admin') {
      insertData.category = 'personal';
      const retry = await supabase.from('recurring_tasks').insert(insertData);
      error = retry.error;
    }
  }

  if (error) {
    throw new Error(error.message || 'Failed to create recurring task');
  }
  revalidatePath('/today');
}

export async function updateRecurringTask(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Strip empty strings that reference potentially missing columns
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value === '' ? null : value;
    }
  }

  // Separate base fields (always exist) from extended fields (need migration 00007)
  const extendedColumns = ['client_id', 'weight', 'energy', 'estimated_minutes'];
  const hasExtendedFields = extendedColumns.some(col => col in cleanUpdates);

  let { error } = await supabase
    .from('recurring_tasks')
    .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  // If columns don't exist (migration 00007 not run), retry with only base fields
  if (error && hasExtendedFields && (error.message?.includes('schema cache') || error.message?.includes('column'))) {
    const baseUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(cleanUpdates)) {
      if (!extendedColumns.includes(key)) {
        baseUpdates[key] = value;
      }
    }
    if (Object.keys(baseUpdates).length > 0) {
      const retry = await supabase
        .from('recurring_tasks')
        .update({ ...baseUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      error = retry.error;
    } else {
      // Only extended fields requested but columns missing
      throw new Error('Cannot update weight/energy/client — run pending migrations (see supabase/migrations/RUN_ALL_PENDING.sql)');
    }
  }

  if (error) throw new Error(error.message || 'Failed to update recurring task');
  revalidatePath('/today');
}

export async function deleteRecurringTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('recurring_tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
}

export async function toggleRecurringTaskCompletion(recurringTaskId: string, completed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  if (completed) {
    const { error } = await supabase
      .from('recurring_task_completions')
      .insert({
        user_id: user.id,
        recurring_task_id: recurringTaskId,
        date: today,
      });
    if (error && !error.message.includes('duplicate')) throw error;
  } else {
    const { error } = await supabase
      .from('recurring_task_completions')
      .delete()
      .eq('recurring_task_id', recurringTaskId)
      .eq('date', today)
      .eq('user_id', user.id);
    if (error) throw error;
  }

  revalidatePath('/today');
}
