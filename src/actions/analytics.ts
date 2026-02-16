'use server';

import { createClient } from '@/lib/supabase/server';
import { getTaskMLU } from '@/lib/utils/mental-load';

export async function getProjectEnergyBreakdown() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [tasksRes, clientsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('client_id, weight, energy, estimated_minutes, status, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo),
    supabase
      .from('clients')
      .select('id, name')
      .eq('user_id', user.id),
  ]);

  if (tasksRes.error) throw tasksRes.error;

  // Build client name lookup
  const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]));

  // Use MLU-based energy instead of raw weight multipliers
  const clientEnergy: Record<string, { energy: number; taskCount: number; totalMinutes: number }> = {};

  (tasksRes.data || []).forEach((task) => {
    const clientName = task.client_id ? (clientMap.get(task.client_id) || 'Unknown Client') : 'Personal / Unassigned';
    if (!clientEnergy[clientName]) {
      clientEnergy[clientName] = { energy: 0, taskCount: 0, totalMinutes: 0 };
    }
    const mlu = getTaskMLU({ weight: task.weight, energy: task.energy });
    const minutes = task.estimated_minutes || 30;
    clientEnergy[clientName].energy += mlu;
    clientEnergy[clientName].taskCount += 1;
    clientEnergy[clientName].totalMinutes += minutes;
  });

  return Object.entries(clientEnergy)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.energy - a.energy);
}

export async function getClientEfficiency() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [tasksRes, clientsRes, overridesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('client_id, weight, energy, estimated_minutes, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('client_id', 'is', null)
      .gte('completed_at', thirtyDaysAgo),
    supabase
      .from('clients')
      .select('id, name, retainer_amount, is_active')
      .eq('user_id', user.id),
    // Current month overrides — so analytics matches finance page
    Promise.resolve(
      supabase
        .from('client_monthly_overrides')
        .select('client_id, amount')
        .eq('user_id', user.id)
        .eq('month', currentMonthKey)
    ).then(res => res.error ? { data: [] as { client_id: string; amount: number }[] } : res)
     .catch(() => ({ data: [] as { client_id: string; amount: number }[] })),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (clientsRes.error) throw clientsRes.error;

  // Build override map
  const overrideMap = new Map<string, number>();
  const overrideData = (overridesRes as { data: { client_id: string; amount: number }[] | null })?.data || [];
  for (const o of overrideData) {
    overrideMap.set(o.client_id, Number(o.amount));
  }

  const clientMLU: Record<string, number> = {};
  (tasksRes.data || []).forEach((task) => {
    if (!task.client_id) return;
    const mlu = getTaskMLU({ weight: task.weight, energy: task.energy });
    clientMLU[task.client_id] = (clientMLU[task.client_id] || 0) + mlu;
  });

  const clientMap = new Map((clientsRes.data || []).map((c) => [c.id, c]));

  return Object.entries(clientMLU)
    .map(([clientId, energy]) => {
      const client = clientMap.get(clientId);
      // Use override if present, otherwise fall back to retainer_amount
      const revenue = overrideMap.has(clientId)
        ? overrideMap.get(clientId)!
        : (client?.retainer_amount || 0);
      return {
        name: client?.name || 'Unknown',
        energy,
        revenue,
        efficiency: energy > 0 ? Math.round(revenue / energy) : 0, // £/MLU per month
        isActive: client?.is_active ?? false,
      };
    })
    .sort((a, b) => b.efficiency - a.efficiency);
}

export async function getWeeklyCompletionTrend() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const { data, error } = await supabase
    .from('tasks')
    .select('completed_at, weight, energy')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', twelveWeeksAgo.toISOString());

  if (error) throw error;

  // Group by week
  const weeks: Record<string, { count: number; energy: number }> = {};
  (data || []).forEach((task) => {
    if (!task.completed_at) return;
    const date = new Date(task.completed_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split('T')[0];
    if (!weeks[key]) weeks[key] = { count: 0, energy: 0 };
    weeks[key].count += 1;
    weeks[key].energy += getTaskMLU({ weight: task.weight, energy: task.energy });
  });

  return Object.entries(weeks)
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export async function getFinancialHistory() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('month, total_revenue, total_expenses')
    .eq('user_id', user.id)
    .order('month', { ascending: true })
    .limit(18);

  if (error) throw error;
  return data || [];
}
