'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getMonthStart } from '@/lib/utils/date';

export async function getClients() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .order('is_active', { ascending: false })
    .order('name');

  if (error) throw error;
  return data;
}

export async function createClientAction(clientData: {
  name: string;
  retainer_amount?: number;
  payment_day?: number;
  contract_start?: string;
  contract_end?: string;
  contract_length_months?: number;
  renewal_probability?: number;
  risk_flag?: boolean;
  risk_notes?: string;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('clients')
    .insert({ user_id: user.id, ...clientData })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/finance');
  return data;
}

export async function updateClient(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

export async function deleteClient(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

export async function getExpenses(month?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const currentMonth = month || getMonthStart();
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', currentMonth)
    .lt('date', nextMonth.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createExpense(expenseData: {
  description: string;
  amount: number;
  category: string;
  date: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  expense_type?: 'business' | 'personal';
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('expenses')
    .insert({ user_id: user.id, ...expenseData });

  if (error) throw error;
  revalidatePath('/finance');
}

export async function updateExpense(id: string, updates: {
  description?: string;
  amount?: number;
  category?: string;
  date?: string;
  is_recurring?: boolean;
  recurring_frequency?: string | null;
  expense_type?: 'business' | 'personal';
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    // Retry without expense_type in case migration hasn't been run
    const safeUpdates = { ...updates };
    delete safeUpdates.expense_type;
    const { error: retryError } = await supabase
      .from('expenses')
      .update(safeUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (retryError) throw retryError;
  }

  revalidatePath('/finance');
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

export async function getFinancialSnapshot(month?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const currentMonth = month || getMonthStart();

  const { data } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', currentMonth)
    .single();

  return data;
}

export async function getFinancialHistory(limit: number = 18) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function upsertFinancialSnapshot(updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Allow specifying a custom month (for historical entries)
  const month = (updates.month as string) || getMonthStart();
  const { month: _, ...rest } = updates;

  const { error } = await supabase
    .from('financial_snapshots')
    .upsert(
      {
        user_id: user.id,
        month,
        ...rest,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,month' }
    );

  if (error) throw error;
  revalidatePath('/finance');
}

export async function updateFinancialSnapshot(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('financial_snapshots')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

export async function deleteFinancialSnapshot(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('financial_snapshots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

// ━━━ CLIENT MONTHLY OVERRIDES ━━━

export async function getClientOverrides(month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // month format: 'YYYY-MM-DD' -> we need 'YYYY-MM'
  const monthKey = month.slice(0, 7);

  const { data, error } = await supabase
    .from('client_monthly_overrides')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', monthKey);

  if (error) {
    // Table may not exist yet if migration hasn't run
    console.warn('client_monthly_overrides query failed:', error.message);
    return [];
  }
  return data || [];
}

export async function getClientOverridesForClient(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('client_monthly_overrides')
    .select('*')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .order('month', { ascending: false })
    .limit(12);

  if (error) {
    console.warn('client_monthly_overrides query failed:', error.message);
    return [];
  }
  return data || [];
}

export async function getAllClientOverrides() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('client_monthly_overrides')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: false });

  if (error) {
    console.warn('client_monthly_overrides query failed:', error.message);
    return [];
  }
  return data || [];
}

export async function deleteClientOverridesForMonth(month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const monthKey = month.slice(0, 7);
  const { error } = await supabase
    .from('client_monthly_overrides')
    .delete()
    .eq('user_id', user.id)
    .eq('month', monthKey);

  if (error) {
    console.warn('Failed to delete overrides for month:', error.message);
  }
}

export async function upsertClientOverride(
  clientId: string,
  month: string,
  amount: number,
  notes?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const monthKey = month.slice(0, 7);

  const { error } = await supabase
    .from('client_monthly_overrides')
    .upsert(
      {
        user_id: user.id,
        client_id: clientId,
        month: monthKey,
        amount,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,month' }
    );

  if (error) {
    // Table may not exist — migration 00010 not yet run
    if (error.message?.includes('relation') || error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('Override table missing — please run migration 00010 in Supabase SQL Editor, then retry.');
    }
    throw new Error(error.message || 'Failed to save override');
  }
  revalidatePath('/finance');
}

export async function deleteClientOverride(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('client_monthly_overrides')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

// ━━━ ONE-OFF PAYMENTS ━━━

export async function getAllOneoffPayments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('oneoff_payments')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: true });

  if (error) {
    console.warn('oneoff_payments query failed (migration 00024 may not be run):', error.message);
    return [];
  }
  return data || [];
}

export async function createOneoffPayment(paymentData: {
  description: string;
  amount: number;
  month: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const monthKey = paymentData.month.slice(0, 7);

  const { error } = await supabase
    .from('oneoff_payments')
    .insert({
      user_id: user.id,
      description: paymentData.description,
      amount: paymentData.amount,
      month: monthKey,
      notes: paymentData.notes || null,
    });

  if (error) {
    console.warn('createOneoffPayment failed:', error.message);
    return { success: false, error: error.message?.includes('relation') ? 'Run migration 00024 first' : error.message };
  }
  revalidatePath('/finance');
  return { success: true };
}

export async function deleteOneoffPayment(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('oneoff_payments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.warn('deleteOneoffPayment failed:', error.message);
    return { success: false, error: error.message };
  }
  revalidatePath('/finance');
  return { success: true };
}

// ━━━ EXPENSE MONTHLY OVERRIDES ━━━

export async function getAllExpenseOverrides() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('expense_monthly_overrides')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: true });

  if (error) {
    console.warn('expense_monthly_overrides query failed (migration 00025 may not be run):', error.message);
    return [];
  }
  return data || [];
}

export async function upsertExpenseOverride(
  month: string,
  staffCost: number | null,
  salary: number | null,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const monthKey = month.slice(0, 7);

  // If both are null, delete the override entirely
  if (staffCost === null && salary === null) {
    const { error } = await supabase
      .from('expense_monthly_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('month', monthKey);
    if (error) {
      console.warn('deleteExpenseOverride failed:', error.message);
      return { success: false, error: error.message };
    }
    revalidatePath('/finance');
    return { success: true };
  }

  const { error } = await supabase
    .from('expense_monthly_overrides')
    .upsert(
      {
        user_id: user.id,
        month: monthKey,
        staff_cost: staffCost,
        salary: salary,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,month' }
    );

  if (error) {
    if (error.message?.includes('relation') || error.code === '42P01') {
      return { success: false, error: 'Run migration 00025 first' };
    }
    return { success: false, error: error.message };
  }
  revalidatePath('/finance');
  return { success: true };
}

export async function deleteExpenseOverride(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('expense_monthly_overrides')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.warn('deleteExpenseOverride failed:', error.message);
    return { success: false, error: error.message };
  }
  revalidatePath('/finance');
  return { success: true };
}

// ━━━ SAVINGS GOALS ━━━

export async function getSavingsGoals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    // Table may not exist yet if migration hasn't run
    console.warn('savings_goals query failed:', error.message);
    return [];
  }
  return data || [];
}

export async function createSavingsGoal(goalData: {
  label: string;
  target_amount: number;
  current_amount?: number;
  color?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('savings_goals')
    .insert({ user_id: user.id, ...goalData });

  if (error) throw error;
  revalidatePath('/finance');
}

export async function updateSavingsGoal(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('savings_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

export async function deleteSavingsGoal(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/finance');
}

// ━━━ HELPERS ━━━

/**
 * Get clients with current month overrides applied to retainer_amount.
 * Use this anywhere you need client revenue to match what the finance page shows.
 */
export async function getClientsWithOverrides() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [clients, overrides] = await Promise.all([
    getClients().catch(() => []),
    getClientOverrides(currentMonth).catch(() => []),
  ]);

  if (!overrides || overrides.length === 0) return clients;

  const overrideMap = new Map(
    overrides.map((o: { client_id: string; amount: number }) => [o.client_id, Number(o.amount)])
  );

  return (clients || []).map((c: { id: string; retainer_amount?: number | null; [key: string]: unknown }) => {
    if (overrideMap.has(c.id)) {
      return { ...c, retainer_amount: overrideMap.get(c.id)! };
    }
    return c;
  });
}
