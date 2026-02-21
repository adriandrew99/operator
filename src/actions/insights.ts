'use server';

import { createClient } from '@/lib/supabase/server';
import { getTaskMLU } from '@/lib/utils/mental-load';

// ━━━ Types ━━━
export interface ClientEnergyProfile {
  clientId: string;
  name: string;
  monthlyRevenue: number;
  totalMLU: number;
  taskCount: number;
  avgMLUPerTask: number;
  revenuePerMLU: number; // £ earned per unit of mental energy
  energyMix: { creative: number; admin: number };
  weightMix: { high: number; medium: number; low: number };
  isActive: boolean;
  riskFlag: string | null;
  renewalProbability: number | null;
}

export interface RevenueInsight {
  type: 'growth' | 'decline' | 'concentration' | 'stability' | 'risk' | 'efficiency' | 'opportunity';
  severity: 'info' | 'positive' | 'warning' | 'danger';
  title: string;
  detail: string;
  metric?: string;
}

export interface RevenueTrend {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface EnergyTrend {
  week: string;
  label: string;
  totalMLU: number;
  adminMLU: number;
  creativeMLU: number;
  taskCount: number;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  taskCount: number;
  totalMLU: number;
  avgMLUPerTask: number;
  creativePct: number;
  clientCount: number;
  deltas: {
    revenue: number | null;
    profit: number | null;
    taskCount: number | null;
    totalMLU: number | null;
    creativePct: number | null;
    clientCount: number | null;
  };
}

export interface ClientHealthScore {
  clientId: string;
  name: string;
  healthScore: number;
  factors: {
    velocity: number;
    efficiency: number;
    risk: number;
    renewal: number;
    balance: number;
  };
  trend: 'improving' | 'stable' | 'declining';
}

// ━━━ Client Energy Profiles ━━━
export async function getClientEnergyProfiles(): Promise<ClientEnergyProfile[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Only look at last 30 days of completed tasks — aligns with monthly retainer for efficiency calc
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [tasksRes, clientsRes, recurringRes, recurringCompletionsRes, overridesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('client_id, weight, energy, estimated_minutes, status, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('client_id', 'is', null)
      .gte('completed_at', thirtyDaysAgo),
    supabase
      .from('clients')
      .select('id, name, retainer_amount, is_active, risk_flag, renewal_probability')
      .eq('user_id', user.id),
    // Recurring tasks with client assignments — graceful if table missing
    Promise.resolve(
      supabase.from('recurring_tasks').select('id, client_id, weight, energy').eq('user_id', user.id).eq('is_active', true).not('client_id', 'is', null)
    ).then(res => res.error ? { data: [] as { id: string; client_id: string | null; weight: string; energy: string }[] } : res)
     .catch(() => ({ data: [] as { id: string; client_id: string | null; weight: string; energy: string }[] })),
    // Recurring completions (last 30 days) — graceful if table missing
    Promise.resolve(
      supabase.from('recurring_task_completions').select('recurring_task_id').eq('user_id', user.id).gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    ).then(res => res.error ? { data: [] as { recurring_task_id: string }[] } : res)
     .catch(() => ({ data: [] as { recurring_task_id: string }[] })),
    // Current month overrides — graceful if table missing
    Promise.resolve(
      supabase.from('client_monthly_overrides').select('client_id, amount').eq('user_id', user.id).eq('month', currentMonthKey)
    ).then(res => res.error ? { data: [] as { client_id: string; amount: number }[] } : res)
     .catch(() => ({ data: [] as { client_id: string; amount: number }[] })),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (clientsRes.error) throw clientsRes.error;

  // Build override map: client_id -> overridden amount
  const overrideMap = new Map<string, number>();
  const overrideData = (overridesRes as { data: { client_id: string; amount: number }[] | null })?.data || [];
  for (const o of overrideData) {
    overrideMap.set(o.client_id, Number(o.amount));
  }

  const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
  const clientData: Record<string, {
    totalMLU: number; taskCount: number;
    energyMix: { creative: number; admin: number };
    weightMix: { high: number; medium: number; low: number };
  }> = {};

  function addToClient(clientId: string, weight: string, energy: string) {
    if (!clientData[clientId]) {
      clientData[clientId] = {
        totalMLU: 0, taskCount: 0,
        energyMix: { creative: 0, admin: 0 },
        weightMix: { high: 0, medium: 0, low: 0 },
      };
    }
    const d = clientData[clientId];
    d.totalMLU += getTaskMLU({ weight: weight as 'low' | 'medium' | 'high', energy: energy as 'admin' | 'creative' });
    d.taskCount += 1;
    const e = ((energy || 'admin') === 'deep' ? 'creative' : (energy || 'admin')) as 'creative' | 'admin';
    const w = (weight || 'medium') as 'high' | 'medium' | 'low';
    d.energyMix[e] += 1;
    d.weightMix[w] += 1;
  }

  // Regular completed tasks (skip personal)
  for (const task of (tasksRes.data || [])) {
    if (!task.client_id) continue;
    addToClient(task.client_id, task.weight, task.energy);
  }

  // Recurring task completions — attribute MLU to client
  if (recurringRes.data && recurringCompletionsRes.data) {
    const recurringMap = new Map((recurringRes.data || []).map(rt => [rt.id, rt]));
    const counts: Record<string, number> = {};
    for (const c of (recurringCompletionsRes.data || [])) {
      counts[c.recurring_task_id] = (counts[c.recurring_task_id] || 0) + 1;
    }
    for (const [rtId, count] of Object.entries(counts)) {
      const rt = recurringMap.get(rtId);
      if (!rt?.client_id) continue;
      for (let i = 0; i < count; i++) {
        addToClient(rt.client_id, rt.weight || 'low', rt.energy || 'admin');
      }
    }
  }

  const profiles: ClientEnergyProfile[] = [];
  for (const [clientId, data] of Object.entries(clientData)) {
    const client = clientMap.get(clientId);
    if (!client) continue;
    const monthlyRevenue = overrideMap.has(clientId) ? overrideMap.get(clientId)! : (client.retainer_amount || 0);
    profiles.push({
      clientId,
      name: client.name,
      monthlyRevenue,
      totalMLU: Math.round(data.totalMLU * 10) / 10, // keep 1 decimal precision
      taskCount: data.taskCount,
      avgMLUPerTask: data.taskCount > 0 ? Math.round((data.totalMLU / data.taskCount) * 10) / 10 : 0,
      revenuePerMLU: data.totalMLU > 0 ? Math.round((monthlyRevenue / data.totalMLU) * 100) / 100 : 0,
      energyMix: data.energyMix,
      weightMix: data.weightMix,
      isActive: client.is_active,
      riskFlag: client.risk_flag,
      renewalProbability: client.renewal_probability,
    });
  }

  // Also add clients with no completed tasks yet
  for (const client of (clientsRes.data || [])) {
    if (!clientData[client.id] && client.is_active) {
      profiles.push({
        clientId: client.id,
        name: client.name,
        monthlyRevenue: overrideMap.has(client.id) ? overrideMap.get(client.id)! : (client.retainer_amount || 0),
        totalMLU: 0,
        taskCount: 0,
        avgMLUPerTask: 0,
        revenuePerMLU: 0,
        energyMix: { creative: 0, admin: 0 },
        weightMix: { high: 0, medium: 0, low: 0 },
        isActive: client.is_active,
        riskFlag: client.risk_flag,
        renewalProbability: client.renewal_probability,
      });
    }
  }

  return profiles.sort((a, b) => b.revenuePerMLU - a.revenuePerMLU);
}

// ━━━ Revenue Trends ━━━
export async function getRevenueTrends(): Promise<RevenueTrend[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('month, total_revenue, total_expenses')
    .eq('user_id', user.id)
    .order('month', { ascending: true })
    .limit(12);

  if (error) throw error;

  return (data || []).map(s => ({
    month: s.month,
    label: new Date(s.month + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    revenue: s.total_revenue || 0,
    expenses: s.total_expenses || 0,
    profit: (s.total_revenue || 0) - (s.total_expenses || 0),
  }));
}

// ━━━ Energy Trends (Weekly MLU) ━━━
export async function getEnergyTrends(): Promise<EnergyTrend[]> {
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

  const weeks: Record<string, EnergyTrend> = {};

  for (const task of (data || [])) {
    if (!task.completed_at) continue;
    const date = new Date(task.completed_at);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    const key = monday.toISOString().split('T')[0];

    if (!weeks[key]) {
      weeks[key] = {
        week: key,
        label: monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        totalMLU: 0, adminMLU: 0, creativeMLU: 0, taskCount: 0,
      };
    }

    const mlu = getTaskMLU({ weight: task.weight, energy: task.energy });
    const rawEnergy = (task.energy || 'admin') as string;
    const e = rawEnergy === 'deep' ? 'creative' : rawEnergy;
    weeks[key].totalMLU += mlu;
    weeks[key].taskCount += 1;
    if (e === 'creative') weeks[key].creativeMLU += mlu;
    else weeks[key].adminMLU += mlu;
  }

  return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
}

// ━━━ Monthly Trends Comparison ━━━
export async function getMonthlyTrends(): Promise<MonthlyTrend[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get last 6 months of snapshots
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoKey = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

  const [snapshotsRes, tasksRes, clientsRes] = await Promise.all([
    supabase
      .from('financial_snapshots')
      .select('month, total_revenue, total_expenses')
      .eq('user_id', user.id)
      .gte('month', sixMonthsAgoKey)
      .order('month', { ascending: true }),
    supabase
      .from('tasks')
      .select('client_id, weight, energy, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', sixMonthsAgo.toISOString()),
    supabase
      .from('clients')
      .select('id, is_active, termination_date')
      .eq('user_id', user.id),
  ]);

  if (snapshotsRes.error) throw snapshotsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const snapshots = snapshotsRes.data || [];
  const tasks = tasksRes.data || [];
  const allClients = clientsRes.data || [];

  // Group tasks by month
  const tasksByMonth: Record<string, typeof tasks> = {};
  for (const task of tasks) {
    if (!task.completed_at) continue;
    const date = new Date(task.completed_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!tasksByMonth[monthKey]) tasksByMonth[monthKey] = [];
    tasksByMonth[monthKey].push(task);
  }

  // Build monthly data
  const months: MonthlyTrend[] = [];
  for (const snapshot of snapshots) {
    const monthKey = snapshot.month;
    const monthTasks = tasksByMonth[monthKey] || [];
    const revenue = snapshot.total_revenue || 0;
    const expenses = snapshot.total_expenses || 0;
    const profit = revenue - expenses;
    const taskCount = monthTasks.length;

    // Calculate MLU
    let totalMLU = 0;
    let creativeCount = 0;
    const clientIds = new Set<string>();
    for (const task of monthTasks) {
      totalMLU += getTaskMLU({ weight: task.weight, energy: task.energy });
      const rawEnergy = (task.energy || 'admin') as string;
      if (rawEnergy === 'creative' || rawEnergy === 'deep') creativeCount++;
      if (task.client_id) clientIds.add(task.client_id);
    }

    // Also count active clients for that month (those without termination before month end)
    const monthEnd = new Date(monthKey + '-01');
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const activeClientCount = allClients.filter(c => {
      if (!c.is_active && !c.termination_date) return false;
      if (c.termination_date && new Date(c.termination_date) < new Date(monthKey + '-01')) return false;
      return true;
    }).length;
    const clientCount = Math.max(clientIds.size, activeClientCount);

    const creativePct = taskCount > 0 ? Math.round((creativeCount / taskCount) * 100) : 0;
    const avgMLUPerTask = taskCount > 0 ? Math.round((totalMLU / taskCount) * 10) / 10 : 0;

    months.push({
      month: monthKey,
      label: new Date(monthKey + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      revenue,
      expenses,
      profit,
      taskCount,
      totalMLU: Math.round(totalMLU * 10) / 10,
      avgMLUPerTask,
      creativePct,
      clientCount,
      deltas: { revenue: null, profit: null, taskCount: null, totalMLU: null, creativePct: null, clientCount: null },
    });
  }

  // Calculate deltas (compare each month to previous)
  for (let i = 1; i < months.length; i++) {
    const curr = months[i];
    const prev = months[i - 1];
    curr.deltas = {
      revenue: prev.revenue > 0 ? Math.round(((curr.revenue - prev.revenue) / prev.revenue) * 100) : null,
      profit: prev.profit !== 0 ? Math.round(((curr.profit - prev.profit) / Math.abs(prev.profit)) * 100) : null,
      taskCount: prev.taskCount > 0 ? Math.round(((curr.taskCount - prev.taskCount) / prev.taskCount) * 100) : null,
      totalMLU: prev.totalMLU > 0 ? Math.round(((curr.totalMLU - prev.totalMLU) / prev.totalMLU) * 100) : null,
      creativePct: prev.creativePct > 0 ? Math.round(curr.creativePct - prev.creativePct) : null,
      clientCount: prev.clientCount > 0 ? Math.round(((curr.clientCount - prev.clientCount) / prev.clientCount) * 100) : null,
    };
  }

  return months;
}

// ━━━ Client Health Scores ━━━
export async function getClientHealthScores(): Promise<ClientHealthScore[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [clientsRes, recentTasksRes, olderTasksRes, overridesRes] = await Promise.all([
    supabase.from('clients').select('id, name, retainer_amount, is_active, risk_flag, renewal_probability, termination_date')
      .eq('user_id', user.id).eq('is_active', true),
    supabase.from('tasks').select('client_id, weight, energy, status, completed_at')
      .eq('user_id', user.id).eq('status', 'completed').not('client_id', 'is', null)
      .gte('completed_at', thirtyDaysAgo),
    supabase.from('tasks').select('client_id, weight, energy, status, completed_at')
      .eq('user_id', user.id).eq('status', 'completed').not('client_id', 'is', null)
      .gte('completed_at', sixtyDaysAgo).lt('completed_at', thirtyDaysAgo),
    Promise.resolve(
      supabase.from('client_monthly_overrides').select('client_id, amount').eq('user_id', user.id).eq('month', currentMonthKey)
    ).then(res => res.error ? { data: [] as { client_id: string; amount: number }[] } : res)
     .catch(() => ({ data: [] as { client_id: string; amount: number }[] })),
  ]);

  if (clientsRes.error) throw clientsRes.error;

  const clients = clientsRes.data || [];
  const recentTasks = recentTasksRes.data || [];
  const olderTasks = olderTasksRes.data || [];

  const overrideMap = new Map<string, number>();
  const overrideData = (overridesRes as { data: { client_id: string; amount: number }[] | null })?.data || [];
  for (const o of overrideData) overrideMap.set(o.client_id, Number(o.amount));

  const getRetainer = (c: { id: string; retainer_amount: number | null }) =>
    overrideMap.has(c.id) ? overrideMap.get(c.id)! : (c.retainer_amount || 0);

  // Aggregate recent tasks by client
  const recentByClient: Record<string, { count: number; mlu: number; creative: number; admin: number }> = {};
  for (const t of recentTasks) {
    if (!t.client_id) continue;
    if (!recentByClient[t.client_id]) recentByClient[t.client_id] = { count: 0, mlu: 0, creative: 0, admin: 0 };
    recentByClient[t.client_id].count++;
    recentByClient[t.client_id].mlu += getTaskMLU({ weight: t.weight, energy: t.energy });
    const rawEnergy = (t.energy || 'admin') as string;
    if (rawEnergy === 'creative' || rawEnergy === 'deep') recentByClient[t.client_id].creative++;
    else recentByClient[t.client_id].admin++;
  }

  // Aggregate older tasks by client (for trend comparison)
  const olderByClient: Record<string, { count: number; mlu: number }> = {};
  for (const t of olderTasks) {
    if (!t.client_id) continue;
    if (!olderByClient[t.client_id]) olderByClient[t.client_id] = { count: 0, mlu: 0 };
    olderByClient[t.client_id].count++;
    olderByClient[t.client_id].mlu += getTaskMLU({ weight: t.weight, energy: t.energy });
  }

  // Calculate portfolio avg revenue per MLU
  const totalPortfolioMLU = Object.values(recentByClient).reduce((s, v) => s + v.mlu, 0);
  const totalPortfolioRevenue = clients.reduce((s, c) => s + getRetainer(c), 0);
  const avgRevenuePerMLU = totalPortfolioMLU > 0 ? totalPortfolioRevenue / totalPortfolioMLU : 0;

  const scores: ClientHealthScore[] = [];

  for (const client of clients) {
    const recent = recentByClient[client.id] || { count: 0, mlu: 0, creative: 0, admin: 0 };
    const older = olderByClient[client.id] || { count: 0, mlu: 0 };
    const retainer = getRetainer(client);

    // Factor 1: Task completion velocity (max 30pts)
    // At least 1 task/week = healthy. Scale from 0-4+ tasks/month
    const velocityScore = Math.min(30, Math.round((recent.count / 4) * 30));

    // Factor 2: Revenue per MLU efficiency (max 25pts)
    // Above avg = full points, scale down from there
    let efficiencyScore = 0;
    if (recent.mlu > 0 && avgRevenuePerMLU > 0) {
      const clientRevPerMLU = retainer / recent.mlu;
      const ratio = clientRevPerMLU / avgRevenuePerMLU;
      efficiencyScore = Math.min(25, Math.round(ratio * 25));
    } else if (recent.mlu === 0 && retainer > 0) {
      // Paid but no work — could be good (light scope) or bad (disengaged)
      efficiencyScore = 15;
    }

    // Factor 3: Risk flag status (max 20pts)
    const riskScore = (!client.risk_flag || client.risk_flag === 'none') ? 20 : 0;

    // Factor 4: Renewal probability (max 15pts)
    let renewalScore = 0;
    if (client.renewal_probability !== null && client.renewal_probability !== undefined) {
      renewalScore = Math.round((client.renewal_probability / 100) * 15);
    } else {
      renewalScore = 10; // unknown = neutral
    }

    // Factor 5: Energy balance (max 10pts)
    // Best = 30-70% creative. Pure one-type = lower score
    let balanceScore = 0;
    const totalTasks = recent.creative + recent.admin;
    if (totalTasks > 0) {
      const creativePct = (recent.creative / totalTasks) * 100;
      if (creativePct >= 25 && creativePct <= 75) {
        balanceScore = 10;
      } else if (creativePct >= 10 && creativePct <= 90) {
        balanceScore = 6;
      } else {
        balanceScore = 3;
      }
    } else {
      balanceScore = 5; // no tasks = neutral
    }

    const healthScore = Math.min(100, velocityScore + efficiencyScore + riskScore + renewalScore + balanceScore);

    // Determine trend based on task volume + MLU comparison
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (older.count > 0) {
      const countChange = ((recent.count - older.count) / older.count) * 100;
      if (countChange > 20) trend = 'improving';
      else if (countChange < -20) trend = 'declining';
    } else if (recent.count > 0) {
      trend = 'improving'; // went from no tasks to some tasks
    }

    scores.push({
      clientId: client.id,
      name: client.name,
      healthScore,
      factors: {
        velocity: velocityScore,
        efficiency: efficiencyScore,
        risk: riskScore,
        renewal: renewalScore,
        balance: balanceScore,
      },
      trend,
    });
  }

  // Sort by health score ascending (lowest first to highlight attention needed)
  scores.sort((a, b) => a.healthScore - b.healthScore);
  return scores;
}

// ━━━ Auto-Generated Insights ━━━
export async function generateInsights(): Promise<RevenueInsight[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [clientsRes, snapshotsRes, tasksRes, expensesRes, overridesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('user_id', user.id),
    supabase.from('financial_snapshots').select('*').eq('user_id', user.id).order('month', { ascending: true }).limit(12),
    supabase.from('tasks').select('client_id, weight, energy, status, completed_at').eq('user_id', user.id).eq('status', 'completed').not('client_id', 'is', null).gte('completed_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('expenses').select('amount').eq('user_id', user.id).gte('date', currentMonthStart),
    Promise.resolve(
      supabase.from('client_monthly_overrides').select('client_id, amount').eq('user_id', user.id).eq('month', currentMonthKey)
    ).then(res => res.error ? { data: [] as { client_id: string; amount: number }[] } : res)
     .catch(() => ({ data: [] as { client_id: string; amount: number }[] })),
  ]);

  const clients = clientsRes.data || [];
  const snapshots = snapshotsRes.data || [];
  const tasks = tasksRes.data || [];
  const currentExpenses = (expensesRes.data || []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);
  const insights: RevenueInsight[] = [];

  // Build override map for current month
  const insightOverrides = new Map<string, number>();
  const insightOverrideData = (overridesRes as { data: { client_id: string; amount: number }[] | null })?.data || [];
  for (const o of insightOverrideData) {
    insightOverrides.set(o.client_id, Number(o.amount));
  }

  // Helper to get effective retainer for a client
  function getClientRetainer(client: { id: string; retainer_amount: number | null }): number {
    return insightOverrides.has(client.id) ? insightOverrides.get(client.id)! : (client.retainer_amount || 0);
  }

  const activeClients = clients.filter(c => c.is_active);

  // ── Revenue Growth / Decline ──
  if (snapshots.length >= 3) {
    const recent = snapshots.slice(-3);
    const older = snapshots.slice(-6, -3);
    const recentAvg = recent.reduce((s, r) => s + (r.total_revenue || 0), 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((s, r) => s + (r.total_revenue || 0), 0) / older.length : 0;

    if (olderAvg > 0) {
      const growthPct = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
      if (growthPct > 10) {
        insights.push({
          type: 'growth', severity: 'positive',
          title: 'Revenue is growing',
          detail: `Average monthly revenue increased ${growthPct}% over the last quarter compared to the prior period.`,
          metric: `+${growthPct}%`,
        });
      } else if (growthPct < -10) {
        insights.push({
          type: 'decline', severity: 'danger',
          title: 'Revenue is declining',
          detail: `Average monthly revenue dropped ${Math.abs(growthPct)}% compared to the previous quarter. Review client retention and pipeline.`,
          metric: `${growthPct}%`,
        });
      } else {
        insights.push({
          type: 'stability', severity: 'info',
          title: 'Revenue is stable',
          detail: `Monthly revenue has stayed within ${Math.abs(growthPct)}% over the past two quarters — steady, but look for growth levers.`,
          metric: `${growthPct >= 0 ? '+' : ''}${growthPct}%`,
        });
      }
    }
  }

  // ── Concentration Risk ──
  if (activeClients.length > 0) {
    const totalRevenue = activeClients.reduce((s, c) => s + getClientRetainer(c), 0);
    const maxClient = activeClients.reduce((max, c) => getClientRetainer(c) > getClientRetainer(max) ? c : max, activeClients[0]);
    const maxPct = totalRevenue > 0 ? Math.round((getClientRetainer(maxClient) / totalRevenue) * 100) : 0;

    if (maxPct > 50) {
      insights.push({
        type: 'concentration', severity: 'danger',
        title: `${maxClient.name} is ${maxPct}% of revenue`,
        detail: `Losing this client would cut income by more than half. Actively diversify by converting pipeline leads.`,
        metric: `${maxPct}%`,
      });
    } else if (maxPct > 35) {
      insights.push({
        type: 'concentration', severity: 'warning',
        title: `${maxClient.name} represents ${maxPct}% of revenue`,
        detail: `High dependency on a single client. Aim to get no client above 30% for healthy diversification.`,
        metric: `${maxPct}%`,
      });
    }
  }

  // ── At-Risk Clients ──
  const riskyClients = activeClients.filter(c => c.risk_flag && c.risk_flag !== 'none');
  if (riskyClients.length > 0) {
    const atRiskRevenue = riskyClients.reduce((s, c) => s + getClientRetainer(c), 0);
    insights.push({
      type: 'risk', severity: riskyClients.length > 1 ? 'danger' : 'warning',
      title: `${riskyClients.length} client${riskyClients.length > 1 ? 's' : ''} flagged at risk`,
      detail: `${riskyClients.map(c => c.name).join(', ')} — representing £${atRiskRevenue.toLocaleString()}/mo. Proactively address concerns.`,
      metric: `£${atRiskRevenue.toLocaleString()}`,
    });
  }

  // ── Low Renewal Probability ──
  const lowRenewal = activeClients.filter(c => c.renewal_probability !== null && c.renewal_probability < 60);
  if (lowRenewal.length > 0) {
    insights.push({
      type: 'risk', severity: 'warning',
      title: `${lowRenewal.length} client${lowRenewal.length > 1 ? 's' : ''} with low renewal odds`,
      detail: `${lowRenewal.map(c => `${c.name} (${c.renewal_probability}%)`).join(', ')}. Schedule check-ins and strengthen the relationship.`,
    });
  }

  // ── Energy Efficiency ──
  const clientEnergy: Record<string, number> = {};
  for (const task of tasks) {
    if (!task.client_id) continue;
    const mlu = getTaskMLU({ weight: task.weight, energy: task.energy });
    clientEnergy[task.client_id] = (clientEnergy[task.client_id] || 0) + mlu;
  }

  // Find most draining client (highest energy per £)
  let worstEfficiency = { name: '', revenuePerMLU: Infinity, mlu: 0 };
  let bestEfficiency = { name: '', revenuePerMLU: 0, mlu: 0 };

  for (const client of activeClients) {
    const mlu = clientEnergy[client.id] || 0;
    if (mlu < 0.5) continue; // need at least some data
    const revPerMLU = getClientRetainer(client) / mlu;
    if (revPerMLU < worstEfficiency.revenuePerMLU) {
      worstEfficiency = { name: client.name, revenuePerMLU: revPerMLU, mlu };
    }
    if (revPerMLU > bestEfficiency.revenuePerMLU) {
      bestEfficiency = { name: client.name, revenuePerMLU: revPerMLU, mlu };
    }
  }

  if (worstEfficiency.name && bestEfficiency.name && worstEfficiency.name !== bestEfficiency.name) {
    insights.push({
      type: 'efficiency', severity: 'positive',
      title: `${bestEfficiency.name} is your most efficient client`,
      detail: `You earn £${bestEfficiency.revenuePerMLU.toFixed(2)} per mental load unit with ${bestEfficiency.name}, vs £${worstEfficiency.revenuePerMLU.toFixed(2)} with ${worstEfficiency.name}. Consider rebalancing effort.`,
      metric: `£${bestEfficiency.revenuePerMLU.toFixed(0)}/MLU`,
    });

    // Flag least efficient client separately if the gap is significant
    if (bestEfficiency.revenuePerMLU > worstEfficiency.revenuePerMLU * 3) {
      insights.push({
        type: 'efficiency', severity: 'warning',
        title: `${worstEfficiency.name} is draining your energy`,
        detail: `Only £${worstEfficiency.revenuePerMLU.toFixed(2)}/MLU — ${Math.round(bestEfficiency.revenuePerMLU / worstEfficiency.revenuePerMLU)}x less efficient than ${bestEfficiency.name}. Consider renegotiating scope or pricing.`,
        metric: `£${worstEfficiency.revenuePerMLU.toFixed(0)}/MLU`,
      });
    }
  }

  // ── Client Count Health ──
  if (activeClients.length <= 2) {
    insights.push({
      type: 'opportunity', severity: 'warning',
      title: 'Low client diversification',
      detail: `Only ${activeClients.length} active client${activeClients.length === 1 ? '' : 's'}. Target 4-6 clients for stable, diversified revenue.`,
      metric: `${activeClients.length}`,
    });
  } else if (activeClients.length >= 8) {
    insights.push({
      type: 'opportunity', severity: 'warning',
      title: 'High client volume',
      detail: `${activeClients.length} active clients is a lot of context switching. Consider whether lower-paying clients are worth the mental overhead.`,
      metric: `${activeClients.length}`,
    });
  }

  // ── Profit Margin (live data: active client retainers vs current expenses) ──
  const liveRevenue = activeClients.reduce((s: number, c: { id: string; retainer_amount: number | null }) => s + getClientRetainer(c), 0);
  const marginRevenue = liveRevenue > 0 ? liveRevenue : (snapshots.length > 0 ? (snapshots[snapshots.length - 1].total_revenue || 0) : 0);
  const marginExpenses = currentExpenses > 0 ? currentExpenses : (snapshots.length > 0 ? (snapshots[snapshots.length - 1].total_expenses || 0) : 0);

  if (marginRevenue > 0) {
    const margin = Math.round(((marginRevenue - marginExpenses) / marginRevenue) * 100);
    if (margin < 40) {
      insights.push({
        type: 'efficiency', severity: 'warning',
        title: `Profit margin is ${margin}%`,
        detail: `After expenses, you keep ${margin}% of revenue. Healthy target for a solo operator is 60-80%. Review your expense categories.`,
        metric: `${margin}%`,
      });
    } else if (margin > 75) {
      insights.push({
        type: 'efficiency', severity: 'positive',
        title: `Strong ${margin}% profit margin`,
        detail: `You're keeping most of what you earn. Good cost discipline — consider investing surplus in growth.`,
        metric: `${margin}%`,
      });
    }
  }

  // ── Financial Year Insights ──
  // UK FY: 6 April → 5 April
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = `${fyStartYear}-04-01`;
  const fyEnd = `${fyStartYear + 1}-03-31`;
  const fySnapshots = snapshots.filter(s => s.month >= fyStart && s.month <= fyEnd);

  if (fySnapshots.length >= 2) {
    const fyRevenue = fySnapshots.reduce((s, sn) => s + (Number(sn.total_revenue) || 0), 0);
    const fyExpenses = fySnapshots.reduce((s, sn) => s + (Number(sn.total_expenses) || 0), 0);
    const fyTax = fySnapshots.reduce((s, sn) => s + (Number(sn.corp_tax_reserve) || 0), 0);
    const fyNet = fyRevenue - fyExpenses - fyTax;
    const monthsElapsed = fySnapshots.length;
    const avgMonthly = fyRevenue / monthsElapsed;
    const projectedAnnual = avgMonthly * 12;

    // FY annual projection
    if (monthsElapsed >= 3) {
      insights.push({
        type: 'growth', severity: 'info',
        title: `On track for £${Math.round(projectedAnnual / 1000)}k this FY`,
        detail: `Based on ${monthsElapsed} months of data, you're projecting £${Math.round(projectedAnnual).toLocaleString()} revenue for ${fyStartYear}/${String(fyStartYear + 1).slice(-2)}. Net after expenses and tax: ~£${Math.round(fyNet / monthsElapsed * 12).toLocaleString()}.`,
        metric: `£${Math.round(projectedAnnual / 1000)}k`,
      });
    }

    // FY expense ratio trend
    if (fyRevenue > 0) {
      const fyExpenseRatio = Math.round((fyExpenses / fyRevenue) * 100);
      if (fyExpenseRatio > 50) {
        insights.push({
          type: 'efficiency', severity: 'warning',
          title: `FY expenses are ${fyExpenseRatio}% of revenue`,
          detail: `Year-to-date you've spent £${Math.round(fyExpenses).toLocaleString()} against £${Math.round(fyRevenue).toLocaleString()} revenue. Aim to keep expenses below 40% for a healthy margin.`,
          metric: `${fyExpenseRatio}%`,
        });
      }
    }

    // Monthly revenue consistency (coefficient of variation)
    if (monthsElapsed >= 3) {
      const monthlyRevenues = fySnapshots.map(s => Number(s.total_revenue) || 0).filter(v => v > 0);
      if (monthlyRevenues.length >= 3) {
        const mean = monthlyRevenues.reduce((a, b) => a + b, 0) / monthlyRevenues.length;
        const variance = monthlyRevenues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / monthlyRevenues.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? Math.round((stdDev / mean) * 100) : 0;

        if (cv > 40) {
          insights.push({
            type: 'risk', severity: 'warning',
            title: 'Income is volatile this FY',
            detail: `Your monthly revenue varies by ~${cv}% — from £${Math.round(Math.min(...monthlyRevenues)).toLocaleString()} to £${Math.round(Math.max(...monthlyRevenues)).toLocaleString()}. Recurring retainers help smooth this out.`,
            metric: `±${cv}%`,
          });
        } else if (cv < 15 && monthlyRevenues.length >= 4) {
          insights.push({
            type: 'stability', severity: 'positive',
            title: 'Consistent income this FY',
            detail: `Monthly revenue only varies by ~${cv}% — strong predictability. This makes financial planning much easier.`,
            metric: `±${cv}%`,
          });
        }
      }
    }

    // Corp tax projection
    if (fyNet > 0 && monthsElapsed >= 3) {
      const projectedTax = Math.round(Math.max(0, projectedAnnual - (fyExpenses / monthsElapsed * 12)) * 0.19);
      if (projectedTax > 5000) {
        insights.push({
          type: 'risk', severity: 'info',
          title: `~£${Math.round(projectedTax / 1000)}k corp tax liability this FY`,
          detail: `Based on current trends, expect roughly £${projectedTax.toLocaleString()} in corporation tax for ${fyStartYear}/${String(fyStartYear + 1).slice(-2)}. Ensure your reserves match.`,
          metric: `£${Math.round(projectedTax / 1000)}k`,
        });
      }
    }
  }

  return insights;
}

// ━━━ Analytics-Specific Insights (deeper, energy-focused) ━━━
export async function generateAnalyticsInsights(): Promise<RevenueInsight[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [clientsRes, tasksRes, olderTasksRes, overridesRes] = await Promise.all([
    supabase.from('clients').select('id, name, retainer_amount, is_active').eq('user_id', user.id),
    supabase.from('tasks').select('client_id, weight, energy, estimated_minutes, completed_at')
      .eq('user_id', user.id).eq('status', 'completed').gte('completed_at', thirtyDaysAgo),
    supabase.from('tasks').select('client_id, weight, energy, estimated_minutes, completed_at')
      .eq('user_id', user.id).eq('status', 'completed').gte('completed_at', sixtyDaysAgo).lt('completed_at', thirtyDaysAgo),
    Promise.resolve(
      supabase.from('client_monthly_overrides').select('client_id, amount').eq('user_id', user.id).eq('month', currentMonthKey)
    ).then(res => res.error ? { data: [] as { client_id: string; amount: number }[] } : res)
     .catch(() => ({ data: [] as { client_id: string; amount: number }[] })),
  ]);

  const clients = clientsRes.data || [];
  const tasks = tasksRes.data || [];
  const olderTasks = olderTasksRes.data || [];
  const insights: RevenueInsight[] = [];

  const overrideMap = new Map<string, number>();
  const overrideData = (overridesRes as { data: { client_id: string; amount: number }[] | null })?.data || [];
  for (const o of overrideData) overrideMap.set(o.client_id, Number(o.amount));

  const getRetainer = (c: { id: string; retainer_amount: number | null }) =>
    overrideMap.has(c.id) ? overrideMap.get(c.id)! : (c.retainer_amount || 0);

  const activeClients = clients.filter(c => c.is_active);

  // ── Workload trend: compare last 30d vs prior 30d ──
  const recentMLU = tasks.reduce((s, t) => s + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
  const olderMLU = olderTasks.reduce((s, t) => s + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
  if (olderMLU > 0) {
    const changePct = Math.round(((recentMLU - olderMLU) / olderMLU) * 100);
    if (changePct > 25) {
      insights.push({
        type: 'efficiency', severity: 'warning',
        title: `Workload up ${changePct}% vs last month`,
        detail: `${Math.round(recentMLU)} MLU this period vs ${Math.round(olderMLU)} previously. Check if the increase is sustainable.`,
        metric: `+${changePct}%`,
      });
    } else if (changePct < -25) {
      insights.push({
        type: 'efficiency', severity: 'info',
        title: `Workload dropped ${Math.abs(changePct)}%`,
        detail: `${Math.round(recentMLU)} MLU this period vs ${Math.round(olderMLU)} previously. Lower load could mean capacity for growth.`,
        metric: `${changePct}%`,
      });
    }
  }

  // ── Energy type imbalance ──
  const creativeMLU = tasks.filter(t => (t.energy || 'admin') === 'creative' || (t.energy || 'admin') === 'deep')
    .reduce((s, t) => s + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
  const adminMLU = tasks.filter(t => (t.energy || 'admin') === 'admin')
    .reduce((s, t) => s + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
  const totalMLU = creativeMLU + adminMLU;
  if (totalMLU > 0) {
    const creativePct = Math.round((creativeMLU / totalMLU) * 100);
    if (creativePct > 70) {
      insights.push({
        type: 'efficiency', severity: 'warning',
        title: `${creativePct}% creative work — high cognitive load`,
        detail: 'Heavy creative work burns out fast. Balance with lighter admin days or batch creative sessions.',
        metric: `${creativePct}% creative`,
      });
    } else if (creativePct < 20 && totalMLU > 10) {
      insights.push({
        type: 'opportunity', severity: 'info',
        title: 'Mostly admin work this month',
        detail: `Only ${creativePct}% creative energy. If you\'re a strategist or designer, your clients may not be getting your best thinking.`,
        metric: `${creativePct}% creative`,
      });
    }
  }

  // ── Client efficiency spread ──
  const clientMLU: Record<string, number> = {};
  for (const t of tasks) {
    if (!t.client_id) continue;
    clientMLU[t.client_id] = (clientMLU[t.client_id] || 0) + getTaskMLU({ weight: t.weight, energy: t.energy });
  }

  const efficiencies = activeClients
    .filter(c => (clientMLU[c.id] || 0) > 1)
    .map(c => ({ name: c.name, perMLU: getRetainer(c) / (clientMLU[c.id] || 1) }))
    .sort((a, b) => b.perMLU - a.perMLU);

  if (efficiencies.length >= 2) {
    const best = efficiencies[0];
    const worst = efficiencies[efficiencies.length - 1];
    const gap = best.perMLU / worst.perMLU;
    if (gap > 3) {
      insights.push({
        type: 'efficiency', severity: 'warning',
        title: `${gap.toFixed(1)}x efficiency gap between clients`,
        detail: `${best.name} returns £${Math.round(best.perMLU)}/MLU vs ${worst.name} at £${Math.round(worst.perMLU)}/MLU. Consider rebalancing effort or renegotiating scope.`,
        metric: `${gap.toFixed(1)}x gap`,
      });
    }
  }

  // ── High-weight task volume ──
  const highWeightCount = tasks.filter(t => t.weight === 'high').length;
  const totalCount = tasks.length;
  if (totalCount > 10) {
    const highPct = Math.round((highWeightCount / totalCount) * 100);
    if (highPct > 40) {
      insights.push({
        type: 'efficiency', severity: 'warning',
        title: `${highPct}% of tasks are high-weight`,
        detail: `${highWeightCount} out of ${totalCount} tasks are heavyweight. This is unsustainable — delegate or break down into smaller deliverables.`,
        metric: `${highPct}%`,
      });
    }
  }

  // ── Under-utilised clients ──
  for (const client of activeClients) {
    const retainer = getRetainer(client);
    const mlu = clientMLU[client.id] || 0;
    if (retainer > 0 && mlu < 1) {
      insights.push({
        type: 'opportunity', severity: 'info',
        title: `${client.name}: paid but barely used`,
        detail: `${client.name} pays £${retainer.toLocaleString()}/mo but you've done almost no tracked work. Either scope is very light or tasks aren't being logged.`,
      });
    }
  }

  // ── Estimated hours vs capacity ──
  const totalMinutes = tasks.reduce((s, t) => s + (t.estimated_minutes || 30), 0);
  const totalHours = Math.round(totalMinutes / 60);
  const workDaysPerMonth = 22;
  const estHoursPerDay = totalHours / workDaysPerMonth;
  if (estHoursPerDay > 7) {
    insights.push({
      type: 'efficiency', severity: 'danger',
      title: `~${estHoursPerDay.toFixed(1)}h/day of tracked work`,
      detail: `${totalHours} hours of work this month across ${workDaysPerMonth} work days. You're running hot — protect recovery time.`,
      metric: `${totalHours}h/mo`,
    });
  } else if (estHoursPerDay < 3 && totalCount > 5) {
    insights.push({
      type: 'opportunity', severity: 'info',
      title: `~${estHoursPerDay.toFixed(1)}h/day average workload`,
      detail: `You have spare capacity. Consider taking on more high-leverage work or investing in business development.`,
      metric: `${totalHours}h/mo`,
    });
  }

  return insights;
}

// ━━━ Weekly Debrief Availability Check (lightweight) ━━━
export async function isWeeklyDebriefReady(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const isFriOrLater = dayOfWeek >= 5 || dayOfWeek === 0;
  const daysToMonday = isFriOrLater
    ? (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    : (dayOfWeek - 1 + 7);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Quick count — just check if any completed tasks exist in the week
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', weekStart.toISOString())
    .lt('completed_at', weekEnd.toISOString());

  if (error) return false;
  return (count ?? 0) > 0;
}

// ━━━ Weekly Debrief ━━━
export interface WeeklyClientBreakdown {
  clientId: string;
  name: string;
  taskCount: number;
  totalMLU: number;
  estimatedMinutes: number;
  weeklyPay: number; // monthly retainer / 4.3
  perHour: number;
  perMLU: number;
  energyShare: number; // % of total weekly MLU
}

export interface WeeklyComparison {
  text: string;
}

export interface WeeklySuggestion {
  text: string;
}

export interface WeeklyHeadline {
  label: string;
  client: string;
}

export interface WeeklyDebrief {
  weekLabel: string;
  totalTasks: number;
  totalMLU: number;
  totalMinutes: number;
  internalMLU: number;
  internalTasks: number;
  clients: WeeklyClientBreakdown[];
  topClientShare: number; // % of MLU taken by top client
  comparisons: WeeklyComparison[];
  suggestions: WeeklySuggestion[];
  headlines: WeeklyHeadline[];
}

export async function getWeeklyDebrief(): Promise<WeeklyDebrief | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Calculate last full work week (Mon-Sun)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  // If it's Mon-Thu, show last week. If Fri-Sun, show current week so far.
  const isFriOrLater = dayOfWeek >= 5 || dayOfWeek === 0;
  const daysToMonday = isFriOrLater
    ? (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    : (dayOfWeek - 1 + 7);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [tasksRes, clientsRes, recurringRes, recurringCompletionsRes, overridesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('client_id, weight, energy, estimated_minutes, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', weekStart.toISOString())
      .lt('completed_at', weekEnd.toISOString()),
    supabase
      .from('clients')
      .select('id, name, retainer_amount, is_active')
      .eq('user_id', user.id),
    // Graceful fallback if tables don't exist
    Promise.resolve(
      supabase.from('recurring_tasks').select('id, client_id, weight, energy').eq('user_id', user.id).eq('is_active', true)
    ).then(res => res.error ? { data: [] as { id: string; client_id: string | null; weight: string; energy: string }[] } : res)
     .catch(() => ({ data: [] as { id: string; client_id: string | null; weight: string; energy: string }[] })),
    Promise.resolve(
      supabase.from('recurring_task_completions').select('recurring_task_id').eq('user_id', user.id).gte('date', weekStart.toISOString().split('T')[0]).lt('date', weekEnd.toISOString().split('T')[0])
    ).then(res => res.error ? { data: [] as { recurring_task_id: string }[] } : res)
     .catch(() => ({ data: [] as { recurring_task_id: string }[] })),
    Promise.resolve(
      supabase.from('client_monthly_overrides').select('client_id, amount').eq('user_id', user.id).eq('month', currentMonthKey)
    ).then(res => res.error ? { data: [] as { client_id: string; amount: number }[] } : res)
     .catch(() => ({ data: [] as { client_id: string; amount: number }[] })),
  ]);

  const tasks = tasksRes.data || [];
  const clientsData = clientsRes.data || [];
  const clientMap = new Map(clientsData.map(c => [c.id, c]));

  // Override map
  const overrideMap = new Map<string, number>();
  const overrideData = (overridesRes as { data: { client_id: string; amount: number }[] | null })?.data || [];
  for (const o of overrideData) {
    overrideMap.set(o.client_id, Number(o.amount));
  }

  function getRetainer(clientId: string): number {
    return overrideMap.has(clientId) ? overrideMap.get(clientId)! : (clientMap.get(clientId)?.retainer_amount || 0);
  }

  // Aggregate by client
  const clientAgg: Record<string, { taskCount: number; totalMLU: number; estimatedMinutes: number }> = {};
  let internalMLU = 0;
  let internalTasks = 0;
  let totalMLU = 0;
  let totalMinutes = 0;

  for (const task of tasks) {
    const mlu = getTaskMLU({ weight: task.weight, energy: task.energy });
    const mins = task.estimated_minutes || 30;
    totalMLU += mlu;
    totalMinutes += mins;

    if (task.client_id) {
      if (!clientAgg[task.client_id]) clientAgg[task.client_id] = { taskCount: 0, totalMLU: 0, estimatedMinutes: 0 };
      clientAgg[task.client_id].taskCount += 1;
      clientAgg[task.client_id].totalMLU += mlu;
      clientAgg[task.client_id].estimatedMinutes += mins;
    } else {
      internalMLU += mlu;
      internalTasks += 1;
    }
  }

  // Recurring task completions
  if (recurringRes.data && recurringCompletionsRes.data) {
    const recurringMap = new Map((recurringRes.data || []).map(rt => [rt.id, rt]));
    const counts: Record<string, number> = {};
    for (const c of (recurringCompletionsRes.data || [])) {
      counts[c.recurring_task_id] = (counts[c.recurring_task_id] || 0) + 1;
    }
    for (const [rtId, count] of Object.entries(counts)) {
      const rt = recurringMap.get(rtId);
      if (!rt) continue;
      for (let i = 0; i < count; i++) {
        const mlu = getTaskMLU({ weight: (rt.weight || 'low') as 'low' | 'medium' | 'high', energy: (rt.energy || 'admin') as 'admin' | 'creative' });
        const mins = 15; // recurring tasks are typically quick
        totalMLU += mlu;
        totalMinutes += mins;
        if (rt.client_id) {
          if (!clientAgg[rt.client_id]) clientAgg[rt.client_id] = { taskCount: 0, totalMLU: 0, estimatedMinutes: 0 };
          clientAgg[rt.client_id].taskCount += count;
          clientAgg[rt.client_id].totalMLU += mlu;
          clientAgg[rt.client_id].estimatedMinutes += mins;
        } else {
          internalMLU += mlu;
          internalTasks += count;
        }
      }
    }
  }

  // No work done this week at all — skip debrief
  const totalTaskCount = tasks.length + internalTasks + Object.values(clientAgg).reduce((s, a) => s + a.taskCount, 0);
  if (totalTaskCount === 0) return null;

  // Build client breakdowns sorted by MLU (highest first)
  const clientBreakdowns: WeeklyClientBreakdown[] = Object.entries(clientAgg)
    .map(([clientId, agg]) => {
      const retainer = getRetainer(clientId);
      const weeklyPay = Math.round((retainer / 4.3) * 100) / 100;
      const hours = agg.estimatedMinutes / 60;
      return {
        clientId,
        name: clientMap.get(clientId)?.name || 'Unknown',
        taskCount: agg.taskCount,
        totalMLU: Math.round(agg.totalMLU * 10) / 10,
        estimatedMinutes: agg.estimatedMinutes,
        weeklyPay: Math.round(weeklyPay),
        perHour: hours > 0 ? Math.round(weeklyPay / hours) : 0,
        perMLU: agg.totalMLU > 0 ? Math.round((weeklyPay / agg.totalMLU) * 100) / 100 : 0,
        energyShare: totalMLU > 0 ? Math.round((agg.totalMLU / totalMLU) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalMLU - a.totalMLU);

  const topClientShare = clientBreakdowns.length > 0 ? clientBreakdowns[0].energyShare : 0;

  // Auto-generate comparisons
  const comparisons: WeeklyComparison[] = [];
  if (clientBreakdowns.length >= 2) {
    const first = clientBreakdowns[0];
    const last = clientBreakdowns[clientBreakdowns.length - 1];
    if (first.perMLU > 0 && last.perMLU > 0 && first.name !== last.name) {
      // Find most and least efficient by perMLU
      const sorted = [...clientBreakdowns].filter(c => c.perMLU > 0).sort((a, b) => b.perMLU - a.perMLU);
      if (sorted.length >= 2) {
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        if (best.name !== worst.name) {
          const ratio = Math.round((best.perMLU / worst.perMLU) * 10) / 10;
          comparisons.push({
            text: `${best.name} took ${best.totalMLU} MLU for £${best.weeklyPay}/wk. ${worst.name} took ${worst.totalMLU} MLU for £${worst.weeklyPay}/wk. ${best.name} is ${ratio}x more efficient per mental unit.`,
          });
        }
      }
    }
  }

  // Auto-generate suggestions
  const suggestions: WeeklySuggestion[] = [];
  if (topClientShare > 40) {
    suggestions.push({ text: `${clientBreakdowns[0].name} consumed ${topClientShare}% of your mental energy. Consider reviewing scope or pushing back on lower-value requests.` });
  }
  if (clientBreakdowns.length > 0) {
    const bestPerMLU = [...clientBreakdowns].filter(c => c.perMLU > 0).sort((a, b) => b.perMLU - a.perMLU)[0];
    if (bestPerMLU) {
      suggestions.push({ text: `Protect time for ${bestPerMLU.name} — they give you the best return at £${bestPerMLU.perMLU.toFixed(0)}/MLU.` });
    }
  }
  if (internalMLU > totalMLU * 0.3 && totalMLU > 0) {
    suggestions.push({ text: `Internal work took ${Math.round((internalMLU / totalMLU) * 100)}% of your energy. Check whether any of it could be delegated or batched.` });
  }
  // If any client has low perMLU, flag it
  const drainingClient = clientBreakdowns.filter(c => c.perMLU > 0).sort((a, b) => a.perMLU - b.perMLU)[0];
  if (drainingClient && clientBreakdowns.length >= 2) {
    const avgPerMLU = clientBreakdowns.filter(c => c.perMLU > 0).reduce((s, c) => s + c.perMLU, 0) / clientBreakdowns.filter(c => c.perMLU > 0).length;
    if (drainingClient.perMLU < avgPerMLU * 0.5) {
      suggestions.push({ text: `Review scope for ${drainingClient.name} — they're well below your average efficiency at £${drainingClient.perMLU.toFixed(0)}/MLU.` });
    }
  }

  // Headlines
  const headlines: WeeklyHeadline[] = [];
  if (clientBreakdowns.length > 0) {
    // Most mentally expensive
    headlines.push({ label: 'Most Mentally Expensive', client: clientBreakdowns[0].name });
    // Highest leverage
    const bestLeverage = [...clientBreakdowns].filter(c => c.perMLU > 0).sort((a, b) => b.perMLU - a.perMLU)[0];
    if (bestLeverage && bestLeverage.name !== clientBreakdowns[0].name) {
      headlines.push({ label: 'Highest Leverage', client: bestLeverage.name });
    }
    // Best return per brain hour
    const bestPerHour = [...clientBreakdowns].filter(c => c.perHour > 0).sort((a, b) => b.perHour - a.perHour)[0];
    if (bestPerHour && bestPerHour.name !== clientBreakdowns[0].name && bestPerHour.name !== bestLeverage?.name) {
      headlines.push({ label: 'Best £/Hour', client: bestPerHour.name });
    }
  }

  const result: WeeklyDebrief = {
    weekLabel,
    totalTasks: tasks.length + internalTasks,
    totalMLU: Math.round(totalMLU * 10) / 10,
    totalMinutes,
    internalMLU: Math.round(internalMLU * 10) / 10,
    internalTasks,
    clients: clientBreakdowns,
    topClientShare,
    comparisons,
    suggestions: suggestions.slice(0, 3),
    headlines,
  };

  // Auto-save debrief snapshot (upsert — idempotent)
  const weekStartStr = weekStart.toISOString().split('T')[0];
  Promise.resolve(
    supabase.from('weekly_debrief_history').upsert({
      user_id: user.id,
      week_start: weekStartStr,
      week_label: weekLabel,
      data: result,
    }, { onConflict: 'user_id,week_start' })
  ).catch(() => { /* silent — table might not exist */ });

  return result;
}

// ━━━ Pattern Detection Engine ━━━
export interface DetectedPattern {
  category: 'productivity' | 'energy' | 'correlation' | 'streak' | 'client';
  title: string;
  detail: string;
  metric?: string;
  severity: 'positive' | 'info' | 'warning';
  icon: string; // emoji
}

export async function detectPatterns(): Promise<DetectedPattern[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const twelveWeeksAgo = new Date(Date.now() - 84 * 86400000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  const [tasksRes, scoresRes, clientsRes] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, client_id, weight, energy, status, completed_at, scheduled_date, deadline, estimated_minutes, flagged_for_today, created_at')
      .eq('user_id', user.id)
      .gte('created_at', twelveWeeksAgo),
    Promise.resolve(
      supabase.from('operator_scores')
        .select('date, score, fundamentals')
        .eq('user_id', user.id)
        .gte('date', ninetyDaysAgo.split('T')[0])
        .order('date', { ascending: true })
    ).catch(() => ({ data: null })),
    supabase.from('clients').select('id, name, is_active, retainer_amount').eq('user_id', user.id),
  ]);

  const tasks = tasksRes.data || [];
  const scores = (scoresRes as { data: { date: string; score: number; fundamentals: Record<string, boolean> | null }[] | null }).data || [];
  const clients = clientsRes.data || [];
  const patterns: DetectedPattern[] = [];

  const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at);

  // ── 1. Day-of-week productivity ──
  const dayBuckets: Record<number, { count: number; mlu: number }> = {};
  for (let d = 0; d < 7; d++) dayBuckets[d] = { count: 0, mlu: 0 };
  for (const t of completedTasks) {
    const day = new Date(t.completed_at!).getDay();
    dayBuckets[day].count++;
    dayBuckets[day].mlu += getTaskMLU({ weight: t.weight, energy: t.energy });
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const workDayEntries = Object.entries(dayBuckets)
    .filter(([d]) => Number(d) >= 1 && Number(d) <= 5) // Mon-Fri
    .map(([d, v]) => ({ day: Number(d), name: dayNames[Number(d)], ...v }))
    .sort((a, b) => b.count - a.count);
  const avgCount = workDayEntries.reduce((s, d) => s + d.count, 0) / workDayEntries.length;
  if (workDayEntries.length >= 3 && avgCount > 2) {
    const best = workDayEntries[0];
    const worst = workDayEntries[workDayEntries.length - 1];
    if (best.count > 0 && worst.count > 0 && best.count / worst.count >= 1.5) {
      const pctMore = Math.round(((best.count - avgCount) / avgCount) * 100);
      patterns.push({
        category: 'productivity',
        title: `${best.name}s are your power day`,
        detail: `You complete ${pctMore}% more tasks on ${best.name}s than average. ${worst.name}s are your slowest day. Consider scheduling high-priority work on ${best.name}s.`,
        metric: `${best.count} tasks`,
        severity: 'positive',
        icon: '📈',
      });
    }
  }

  // ── 2. Client energy profiles — which clients are most draining ──
  const clientMLU: Record<string, { mlu: number; count: number; high: number }> = {};
  for (const t of completedTasks) {
    if (!t.client_id) continue;
    if (!clientMLU[t.client_id]) clientMLU[t.client_id] = { mlu: 0, count: 0, high: 0 };
    clientMLU[t.client_id].mlu += getTaskMLU({ weight: t.weight, energy: t.energy });
    clientMLU[t.client_id].count++;
    if (t.weight === 'high') clientMLU[t.client_id].high++;
  }

  const clientEntries = Object.entries(clientMLU)
    .filter(([, v]) => v.count >= 5)
    .map(([id, v]) => {
      const client = clients.find(c => c.id === id);
      return { id, name: client?.name || 'Unknown', avgMLU: v.mlu / v.count, ...v };
    })
    .sort((a, b) => b.avgMLU - a.avgMLU);

  if (clientEntries.length >= 2) {
    const heaviest = clientEntries[0];
    const lightest = clientEntries[clientEntries.length - 1];
    if (heaviest.avgMLU / lightest.avgMLU >= 1.5) {
      patterns.push({
        category: 'client',
        title: `${heaviest.name} tasks are ${(heaviest.avgMLU / lightest.avgMLU).toFixed(1)}× heavier`,
        detail: `${heaviest.name} averages ${heaviest.avgMLU.toFixed(1)} MLU/task vs ${lightest.name} at ${lightest.avgMLU.toFixed(1)} MLU/task. ${heaviest.high > heaviest.count * 0.4 ? 'A lot of their work is high-weight — consider renegotiating scope.' : ''}`,
        metric: `${heaviest.avgMLU.toFixed(1)} MLU/task`,
        severity: heaviest.avgMLU > 3 ? 'warning' : 'info',
        icon: '⚡',
      });
    }
  }

  // ── 3. Score–fundamental correlations ──
  if (scores.length >= 14) {
    // Collect all fundamental keys
    const fundamentalKeys = new Set<string>();
    for (const s of scores) {
      if (s.fundamentals) Object.keys(s.fundamentals).forEach(k => fundamentalKeys.add(k));
    }

    // For each fundamental, compare avg score when done vs not done
    const correlations: { key: string; doneAvg: number; notDoneAvg: number; diff: number; doneCount: number }[] = [];
    for (const key of fundamentalKeys) {
      const done = scores.filter(s => s.fundamentals?.[key] === true);
      const notDone = scores.filter(s => s.fundamentals?.[key] === false || (s.fundamentals && !(key in s.fundamentals)));
      if (done.length >= 5 && notDone.length >= 5) {
        const doneAvg = done.reduce((s, d) => s + (d.score || 0), 0) / done.length;
        const notDoneAvg = notDone.reduce((s, d) => s + (d.score || 0), 0) / notDone.length;
        correlations.push({ key, doneAvg, notDoneAvg, diff: doneAvg - notDoneAvg, doneCount: done.length });
      }
    }

    correlations.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    if (correlations.length > 0 && Math.abs(correlations[0].diff) >= 5) {
      const top = correlations[0];
      const direction = top.diff > 0 ? 'higher' : 'lower';
      const label = top.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      patterns.push({
        category: 'correlation',
        title: `"${label}" = +${Math.abs(Math.round(top.diff))}pt score boost`,
        detail: `When you do "${label}", your operator score averages ${Math.round(top.doneAvg)} vs ${Math.round(top.notDoneAvg)} without it. This is your strongest performance predictor.`,
        metric: `+${Math.abs(Math.round(top.diff))}pts`,
        severity: 'positive',
        icon: '🔗',
      });

      // Second strongest if available
      if (correlations.length > 1 && Math.abs(correlations[1].diff) >= 5) {
        const second = correlations[1];
        const label2 = second.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        patterns.push({
          category: 'correlation',
          title: `"${label2}" also correlates with score`,
          detail: `Score is ${Math.round(Math.abs(second.diff))}pts ${second.diff > 0 ? 'higher' : 'lower'} when you do "${label2}". Combining it with "${label}" could compound your performance.`,
          metric: `${second.diff > 0 ? '+' : ''}${Math.round(second.diff)}pts`,
          severity: 'info',
          icon: '🔗',
        });
      }
    }
  }

  // ── 4. Completion streaks ──
  if (completedTasks.length > 0) {
    const completionDates = new Set(
      completedTasks.map(t => new Date(t.completed_at!).toISOString().split('T')[0])
    );
    const sortedDates = [...completionDates].sort();
    let maxStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      // Allow skipping weekends (1 or 2 day gaps on Sat/Sun)
      if (diffDays === 1 || (diffDays <= 3 && prev.getDay() === 5)) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    }

    // Check current streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const isActiveStreak = completionDates.has(today) || completionDates.has(yesterday);
    let activeStreak = 0;
    if (isActiveStreak) {
      activeStreak = 1;
      let checkDate = completionDates.has(today) ? new Date() : new Date(Date.now() - 86400000);
      for (let i = 0; i < 90; i++) {
        checkDate = new Date(checkDate.getTime() - 86400000);
        const dateStr = checkDate.toISOString().split('T')[0];
        const dayOfWeek = checkDate.getDay();
        if (completionDates.has(dateStr)) {
          activeStreak++;
        } else if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Skip weekends
          continue;
        } else {
          break;
        }
      }
    }

    if (maxStreak >= 5) {
      patterns.push({
        category: 'streak',
        title: activeStreak >= 3
          ? `🔥 ${activeStreak}-day active streak!`
          : `Your best streak: ${maxStreak} consecutive work days`,
        detail: activeStreak >= 3
          ? `You've completed tasks ${activeStreak} work days in a row. Keep it going! Your record is ${maxStreak} days.`
          : `Over the last 12 weeks, your longest run of consecutive work days with completed tasks was ${maxStreak}. Consistency compounds.`,
        metric: activeStreak >= 3 ? `${activeStreak} days` : `${maxStreak} days`,
        severity: activeStreak >= 5 ? 'positive' : 'info',
        icon: '🔥',
      });
    }
  }

  // ── 5. Time-of-day productivity (from scheduled times) ──
  const hourBuckets: Record<number, number> = {};
  for (const t of completedTasks) {
    if (!t.completed_at) continue;
    const hour = new Date(t.completed_at).getHours();
    hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
  }
  const hourEntries = Object.entries(hourBuckets)
    .map(([h, count]) => ({ hour: Number(h), count }))
    .sort((a, b) => b.count - a.count);

  if (hourEntries.length >= 3 && hourEntries[0].count >= 5) {
    const peak = hourEntries[0];
    const peakLabel = peak.hour < 12 ? `${peak.hour}am` : peak.hour === 12 ? '12pm' : `${peak.hour - 12}pm`;
    const isMorning = peak.hour < 12;
    patterns.push({
      category: 'productivity',
      title: `Peak output at ${peakLabel}`,
      detail: `You complete the most tasks around ${peakLabel}. ${isMorning ? 'You\'re a morning operator — protect this window for deep work.' : 'Your afternoon picks up — consider lighter mornings and heavier PM blocks.'}`,
      metric: `${peak.count} tasks`,
      severity: 'info',
      icon: '⏰',
    });
  }

  // ── 6. Weekend work detection ──
  const weekendTasks = completedTasks.filter(t => {
    const day = new Date(t.completed_at!).getDay();
    return day === 0 || day === 6;
  });
  const weekendPct = completedTasks.length > 0 ? Math.round((weekendTasks.length / completedTasks.length) * 100) : 0;
  if (weekendPct > 15) {
    patterns.push({
      category: 'productivity',
      title: `${weekendPct}% of tasks done on weekends`,
      detail: `${weekendTasks.length} tasks completed on weekends. Consistent weekend work erodes recovery. Consider stricter boundaries or front-loading Fridays.`,
      metric: `${weekendPct}%`,
      severity: 'warning',
      icon: '🛑',
    });
  }

  return patterns;
}

// ━━━ Scope Creep Analysis Types ━━━
export interface ScopeCreepClient {
  clientId: string;
  clientName: string;
  severity: 'stable' | 'drifting' | 'creeping';
  weeklyMLU: number[];
  weeklyRevenuePerMLU: number[];
  currentMLU: number;
  currentRevenuePerMLU: number;
  mluTrendPct: number;
  revenuePerMLUTrendPct: number;
  signals: string[];
  recommendation: string | null;
}

export interface ScopeCreepAnalysis {
  clients: ScopeCreepClient[];
  overallHealth: 'healthy' | 'watch' | 'action_needed';
  summary: string;
}

// ━━━ Scope Creep Radar ━━━
export async function getScopeCreepAnalysis(): Promise<ScopeCreepAnalysis | null> {
  const [debriefHistory, clientsData] = await Promise.all([
    getDebriefHistory().catch(() => []),
    (async () => {
      const { getClientsWithOverrides } = await import('@/actions/finance');
      return getClientsWithOverrides().catch(() => []);
    })(),
  ]);

  // Need at least 2 weeks of data for meaningful trend
  if (debriefHistory.length < 2) return null;

  // Sort oldest → newest for trend calculation
  const sorted = [...debriefHistory].sort((a, b) => a.week_start.localeCompare(b.week_start));

  // Build client lookup
  const clientMap = new Map(clientsData.map(c => [c.id, c]));

  // Collect all unique client IDs across all weeks
  const allClientIds = new Set<string>();
  for (const week of sorted) {
    if (week.data?.clients) {
      for (const c of week.data.clients) {
        allClientIds.add(c.clientId);
      }
    }
  }

  // Simple linear regression helper: returns slope as % change per data point
  function linearSlope(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) * (i - xMean);
    }
    return den > 0 ? num / den : 0;
  }

  function pctChange(first: number, last: number): number {
    if (first === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - first) / first) * 100);
  }

  const scopeClients: ScopeCreepClient[] = [];

  for (const clientId of allClientIds) {
    const client = clientMap.get(clientId);
    if (!client || !client.is_active) continue;

    // Extract weekly data for this client
    const weeklyData: { mlu: number; perMLU: number; energyShare: number; taskCount: number; weeklyPay: number }[] = [];
    for (const week of sorted) {
      const cd = week.data?.clients?.find(c => c.clientId === clientId);
      if (cd) {
        weeklyData.push({
          mlu: cd.totalMLU || 0,
          perMLU: cd.perMLU || 0,
          energyShare: cd.energyShare || 0,
          taskCount: cd.taskCount || 0,
          weeklyPay: cd.weeklyPay || 0,
        });
      } else {
        weeklyData.push({ mlu: 0, perMLU: 0, energyShare: 0, taskCount: 0, weeklyPay: 0 });
      }
    }

    // Need at least 2 non-zero entries for meaningful trend
    const nonZero = weeklyData.filter(w => w.mlu > 0);
    if (nonZero.length < 2) continue;

    const mluValues = weeklyData.map(w => w.mlu);
    const perMLUValues = weeklyData.map(w => w.perMLU);
    const energyShareValues = weeklyData.map(w => w.energyShare);
    const taskCountValues = weeklyData.map(w => w.taskCount);

    const mluSlope = linearSlope(mluValues);
    const perMLUSlope = linearSlope(perMLUValues);

    const firstNonZeroMLU = nonZero[0].mlu;
    const lastNonZeroMLU = nonZero[nonZero.length - 1].mlu;
    const firstNonZeroPerMLU = nonZero.find(w => w.perMLU > 0)?.perMLU || 0;
    const lastNonZeroPerMLU = [...nonZero].reverse().find(w => w.perMLU > 0)?.perMLU || 0;

    const mluTrendPct = pctChange(firstNonZeroMLU, lastNonZeroMLU);
    const perMLUTrendPct = pctChange(firstNonZeroPerMLU, lastNonZeroPerMLU);

    const currentMLU = lastNonZeroMLU;
    const currentPerMLU = lastNonZeroPerMLU;

    // Classify severity
    const mluRising = mluSlope > 0.3 && mluTrendPct > 15;
    const perMLUFalling = perMLUSlope < -0.3 && perMLUTrendPct < -10;
    const energyShareRising = linearSlope(energyShareValues) > 0.5;

    // Check sustained trend (last 3 weeks rising)
    const recentMLU = mluValues.slice(-3);
    const sustainedRise = recentMLU.length >= 3 && recentMLU[2] > recentMLU[0] * 1.1;

    let severity: 'stable' | 'drifting' | 'creeping' = 'stable';
    if (mluRising && perMLUFalling && sustainedRise) {
      severity = 'creeping';
    } else if (mluRising || perMLUFalling || energyShareRising) {
      severity = 'drifting';
    }

    // Generate signals
    const signals: string[] = [];
    if (mluTrendPct > 20) signals.push(`MLU up ${mluTrendPct}% over ${sorted.length} weeks`);
    if (mluTrendPct < -20) signals.push(`MLU down ${Math.abs(mluTrendPct)}%`);
    if (perMLUTrendPct < -15) signals.push(`£/MLU dropped from £${firstNonZeroPerMLU.toFixed(0)} to £${lastNonZeroPerMLU.toFixed(0)}`);
    if (perMLUTrendPct > 15) signals.push(`£/MLU improved ${perMLUTrendPct}%`);
    if (energyShareRising && energyShareValues[energyShareValues.length - 1] > 30) {
      signals.push(`Energy share at ${energyShareValues[energyShareValues.length - 1]}%`);
    }
    const taskSlope = linearSlope(taskCountValues);
    if (taskSlope > 0.5) signals.push(`Task volume trending up`);

    // Generate recommendation
    let recommendation: string | null = null;
    if (severity === 'creeping') {
      recommendation = currentPerMLU < 5
        ? 'Scope review urgent — this client is well below viable £/MLU. Consider rate renegotiation.'
        : 'Consider a scope review conversation. Workload is growing while efficiency drops.';
    } else if (severity === 'drifting') {
      if (mluRising && !perMLUFalling) {
        recommendation = 'Workload increasing — monitor whether this becomes sustained.';
      } else if (perMLUFalling) {
        recommendation = 'Efficiency declining. A retainer increase may be warranted if scope has grown.';
      }
    }

    scopeClients.push({
      clientId,
      clientName: client.name,
      severity,
      weeklyMLU: mluValues,
      weeklyRevenuePerMLU: perMLUValues,
      currentMLU: Math.round(currentMLU * 10) / 10,
      currentRevenuePerMLU: Math.round(currentPerMLU * 100) / 100,
      mluTrendPct,
      revenuePerMLUTrendPct: perMLUTrendPct,
      signals,
      recommendation,
    });
  }

  // Sort: creeping first, then drifting, then stable
  const severityOrder = { creeping: 0, drifting: 1, stable: 2 };
  scopeClients.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Overall health
  const creepingCount = scopeClients.filter(c => c.severity === 'creeping').length;
  const driftingCount = scopeClients.filter(c => c.severity === 'drifting').length;
  const overallHealth: 'healthy' | 'watch' | 'action_needed' =
    creepingCount > 0 ? 'action_needed' :
    driftingCount > 0 ? 'watch' : 'healthy';

  // Summary
  let summary = 'All clients within expected scope.';
  if (creepingCount > 0) {
    summary = `${creepingCount} client${creepingCount > 1 ? 's' : ''} showing scope creep — review needed.`;
  } else if (driftingCount > 0) {
    summary = `${driftingCount} client${driftingCount > 1 ? 's' : ''} drifting — keep an eye on workload trends.`;
  }

  return { clients: scopeClients, overallHealth, summary };
}

// ━━━ Debrief History ━━━
export async function getDebriefHistory(): Promise<{ week_start: string; week_label: string; data: WeeklyDebrief }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const res = await Promise.resolve(
    supabase.from('weekly_debrief_history')
      .select('week_start, week_label, data')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(12)
  ).catch(() => ({ data: null, error: null }));

  if (!res || (res as { error: unknown }).error || !res.data) return [];
  return res.data as { week_start: string; week_label: string; data: WeeklyDebrief }[];
}
