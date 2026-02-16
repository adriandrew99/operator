'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getActiveSprints() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSprint(sprintData: {
  title: string;
  description?: string;
  type: string;
  client_id?: string;
  target_date?: string;
  revenue_value?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('sprints')
    .insert({
      user_id: user.id,
      ...sprintData,
    });

  if (error) throw error;
  revalidatePath('/today');
}

export async function updateSprint(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('sprints')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
}

export async function deleteSprint(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('sprints')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/today');
}

export async function getSprintTaskCount(sprintId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('sprint_id', sprintId)
    .eq('user_id', user.id);

  if (error) throw error;
  return count || 0;
}

export async function updateSprintProgress(sprintId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get all tasks linked to this sprint
  const { data: tasks } = await supabase
    .from('tasks')
    .select('status')
    .eq('sprint_id', sprintId)
    .eq('user_id', user.id);

  if (!tasks || tasks.length === 0) return;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  await supabase
    .from('sprints')
    .update({ progress, updated_at: new Date().toISOString() })
    .eq('id', sprintId)
    .eq('user_id', user.id);

  revalidatePath('/today');
}
