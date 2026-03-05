'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { StaffMember } from '@/lib/types/database';

export async function getStaffMembers(): Promise<StaffMember[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    // Table may not exist yet if migration hasn't been run
    console.error('getStaffMembers error:', error.message);
    return [];
  }

  return data || [];
}

export async function getActiveStaffCost(): Promise<number> {
  const members = await getStaffMembers();
  return members
    .filter(m => m.is_active)
    .reduce((sum, m) => sum + (m.monthly_cost || 0), 0);
}

export async function createStaffMember(input: {
  name: string;
  role?: string;
  monthly_cost: number;
  start_date?: string;
  notes?: string;
}): Promise<StaffMember | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('staff_members')
    .insert({
      user_id: user.id,
      name: input.name,
      role: input.role || null,
      monthly_cost: input.monthly_cost,
      start_date: input.start_date || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Also update the legacy staff_cost field on profiles for backward compat
  await syncLegacyStaffCost(supabase, user.id);

  revalidatePath('/finance');
  revalidatePath('/today');
  return data;
}

export async function updateStaffMember(id: string, updates: {
  name?: string;
  role?: string | null;
  monthly_cost?: number;
  is_active?: boolean;
  start_date?: string | null;
  notes?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('staff_members')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  // Sync legacy field
  await syncLegacyStaffCost(supabase, user.id);

  revalidatePath('/finance');
  revalidatePath('/today');
}

export async function deleteStaffMember(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('staff_members')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  // Sync legacy field
  await syncLegacyStaffCost(supabase, user.id);

  revalidatePath('/finance');
  revalidatePath('/today');
}

/**
 * Keep the legacy profiles.staff_cost field in sync with sum of active staff members.
 * This ensures backward compat with existing finance calculations.
 */
async function syncLegacyStaffCost(supabase: import('@supabase/supabase-js').SupabaseClient, userId: string) {
  try {
    const { data } = await supabase
      .from('staff_members')
      .select('monthly_cost')
      .eq('user_id', userId)
      .eq('is_active', true);

    const total = (data || []).reduce((sum: number, m: { monthly_cost: number }) => sum + (m.monthly_cost || 0), 0);

    await supabase
      .from('profiles')
      .update({ staff_cost: total })
      .eq('id', userId);
  } catch (e) {
    // Non-critical — legacy field sync
    console.error('syncLegacyStaffCost error:', e);
  }
}
