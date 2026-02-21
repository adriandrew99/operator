'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { recalculateAutoScore } from '@/actions/score';

export async function getTasks(status: string = 'active') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTask(taskData: {
  title: string;
  description?: string;
  category: string;
  energy: string;
  weight?: string;
  project?: string;
  client_id?: string;
  deadline?: string;
  estimated_minutes?: number;
  is_high_impact?: boolean;
  is_revenue_generating?: boolean;
  is_low_energy?: boolean;
  is_urgent?: boolean;
  is_personal?: boolean;
  flagged_for_today?: boolean;
  scheduled_date?: string;
  scheduled_time_block?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      ...taskData,
    });

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function updateTask(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;

  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function completeTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
  revalidatePath('/score');

  // Recalculate operator score with updated task metrics
  recalculateAutoScore().catch(() => {});
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function getCompletedTasks(limit: number = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function reactivateTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Try with flagged_for_today first, fall back without it if column doesn't exist
  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'active',
      completed_at: null,
      flagged_for_today: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    // Retry without flagged_for_today in case migration hasn't been run
    const { error: retryError } = await supabase
      .from('tasks')
      .update({
        status: 'active',
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (retryError) throw retryError;
  }

  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
  revalidatePath('/score');

  // Recalculate operator score with updated task metrics
  recalculateAutoScore().catch(() => {});
}

export async function getTasksForWeek(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch tasks with deadline OR scheduled_date in range (planner may set scheduled_date without deadline)
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .or(`and(deadline.gte.${startDate},deadline.lte.${endDate}),and(scheduled_date.gte.${startDate},scheduled_date.lte.${endDate})`)
    .order('deadline', { ascending: true });

  // Fallback if scheduled_date column doesn't exist (migration not run)
  if (error) {
    const { data: fallback, error: fbErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('deadline', startDate)
      .lte('deadline', endDate)
      .order('deadline', { ascending: true });
    if (fbErr) throw fbErr;
    return fallback || [];
  }
  return data || [];
}

export async function archiveTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function getArchivedTasks(limit: number = 100) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function permanentlyDeleteTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function bulkArchiveTasks(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function bulkDeleteTasks(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .delete()
    .in('id', ids)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}

export async function flagTaskForToday(id: string, flagged: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({ flagged_for_today: flagged, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  // Silently ignore if flagged_for_today column doesn't exist yet
  if (error && !error.message?.includes('flagged_for_today')) throw error;
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/planner');
}
