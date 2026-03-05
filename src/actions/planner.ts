'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { TimePeriod, Task } from '@/lib/types/database';
import { getTaskMLU } from '@/lib/utils/mental-load';
import { ENERGY_PERIOD_MAP } from '@/lib/constants';

// ━━━ Weekly Goals ━━━

export async function getWeeklyGoals(weekStart: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function upsertWeeklyGoal(weekStart: string, title: string, sortOrder: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('weekly_goals')
    .upsert(
      {
        user_id: user.id,
        week_start: weekStart,
        title,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start,sort_order' }
    );

  if (error) throw error;
  revalidatePath('/planner');
}

export async function toggleWeeklyGoal(goalId: string, completed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('weekly_goals')
    .update({ completed, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
}

export async function deleteWeeklyGoal(goalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('weekly_goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
}

// ━━━ Day Themes ━━━

export async function getDayThemes(weekStart: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('day_themes')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .order('day_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function upsertDayTheme(weekStart: string, dayIndex: number, theme: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('day_themes')
    .upsert(
      {
        user_id: user.id,
        week_start: weekStart,
        day_index: dayIndex,
        theme,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start,day_index' }
    );

  if (error) throw error;
  revalidatePath('/planner');
}

export async function clearDayTheme(weekStart: string, dayIndex: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('day_themes')
    .delete()
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .eq('day_index', dayIndex);

  if (error) throw error;
  revalidatePath('/planner');
}

// ━━━ Period-Based Scheduling ━━━

export async function scheduleTaskToPeriod(taskId: string, date: string, period: TimePeriod) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({
      scheduled_date: date,
      scheduled_time_block: period,
      deadline: date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
  revalidatePath('/today');
}

export async function acceptSuggestion(taskId: string, date: string, period: TimePeriod) {
  return scheduleTaskToPeriod(taskId, date, period);
}

export async function acceptAllSuggestions(suggestions: { taskId: string; date: string; period: TimePeriod }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  await Promise.all(
    suggestions.map(s =>
      supabase
        .from('tasks')
        .update({
          scheduled_date: s.date,
          scheduled_time_block: s.period,
          deadline: s.date,
          updated_at: now,
        })
        .eq('id', s.taskId)
        .eq('user_id', user.id)
        .is('scheduled_date', null) // guard: only if still unscheduled
    )
  );

  revalidatePath('/planner');
  revalidatePath('/today');
}

// ━━━ Suggest Plan ━━━

export interface SuggestionResult {
  taskId: string;
  taskTitle: string;
  date: string;
  period: TimePeriod;
  reasoning: string;
}

export async function suggestPlan(weekStart: string): Promise<SuggestionResult[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const [tasksRes, eventsRes, scheduledRes, profileRes, themesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('scheduled_date', null)
      .or(`deadline.lte.${weekEndStr},flagged_for_today.eq.true,is_urgent.eq.true`)
      .order('sort_order', { ascending: true }),
    supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEndStr),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEndStr)
      .not('scheduled_date', 'is', null),
    Promise.resolve(
      supabase.from('profiles').select('*').eq('id', user.id).single()
    ).catch(() => ({ data: null })),
    supabase
      .from('day_themes')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart),
  ]);

  const allTasks = tasksRes.data || [];
  // Exclude personal tasks from planning — they don't contribute to MLU
  const tasks = allTasks.filter((t: Task) => !t.is_personal);
  if (tasks.length === 0) return [];

  const events = eventsRes.data || [];
  const scheduled = scheduledRes.data || [];
  const profile = profileRes?.data;
  const themes = themesRes.data || [];

  const workDays: number[] = profile?.work_days ?? [1, 2, 3, 4, 5];
  const dailyCapacity = profile?.daily_mlu_capacity ?? 20;

  // Period capacity budgets (morning 40%, afternoon 40%, evening 20%)
  const periodBudget: Record<TimePeriod, number> = {
    morning: dailyCapacity * 0.4,
    afternoon: dailyCapacity * 0.4,
    evening: dailyCapacity * 0.2,
  };

  // Build dates array for the week
  const weekDates: string[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    weekDates.push(date.toISOString().split('T')[0]);
  }

  // Track load per day-period
  const periodLoad: Record<string, number> = {};
  const initKey = (date: string, period: TimePeriod) => `${date}-${period}`;

  for (const date of weekDates) {
    periodLoad[initKey(date, 'morning')] = 0;
    periodLoad[initKey(date, 'afternoon')] = 0;
    periodLoad[initKey(date, 'evening')] = 0;
  }

  // Account for already-scheduled tasks
  for (const t of scheduled) {
    if (!t.scheduled_date || t.is_personal) continue;
    const period = parseTimeBlockToPeriod(t.scheduled_time_block);
    const key = initKey(t.scheduled_date, period);
    if (key in periodLoad) {
      periodLoad[key] += getTaskMLU(t);
    }
  }

  // Account for calendar events (rough: each event takes ~2 MLU of capacity)
  for (const e of events) {
    const hour = parseInt(e.start_time?.split(':')[0] || '9', 10);
    const period: TimePeriod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const key = initKey(e.date, period);
    if (key in periodLoad) {
      periodLoad[key] += 2;
    }
  }

  // Build theme map: dayIndex → theme string
  const themeMap: Record<number, string> = {};
  for (const t of themes) {
    themeMap[t.day_index] = t.theme;
  }

  // Sort tasks by priority (same as existing autoSchedule)
  const prioritized = [...tasks].sort((a, b) => {
    if (a.is_urgent && !b.is_urgent) return -1;
    if (!a.is_urgent && b.is_urgent) return 1;
    const wo: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if ((wo[a.weight] ?? 1) !== (wo[b.weight] ?? 1)) return (wo[a.weight] ?? 1) - (wo[b.weight] ?? 1);
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const suggestions: SuggestionResult[] = [];

  // Determine which periods are still available today based on current time
  function getAvailablePeriodsForDate(date: string): TimePeriod[] {
    if (date !== todayStr) return ['morning', 'afternoon', 'evening'];
    const available: TimePeriod[] = [];
    if (currentHour < 12) available.push('morning');
    if (currentHour < 17) available.push('afternoon');
    available.push('evening'); // evening is always available
    return available;
  }

  // Energy-to-period preference
  const ENERGY_PERIOD_PREF: Record<string, TimePeriod[]> = {
    creative: ['morning', 'afternoon', 'evening'],
    admin: ['afternoon', 'evening', 'morning'],
  };
  const WEIGHT_PERIOD_PREF: Record<string, TimePeriod[]> = {
    high: ['morning', 'afternoon', 'evening'],
    medium: ['afternoon', 'morning', 'evening'],
    low: ['evening', 'afternoon', 'morning'],
  };

  for (const task of prioritized) {
    const energy = task.energy || 'admin';
    const weight = task.weight || 'medium';
    const mlu = getTaskMLU(task);

    // Determine day ordering — only today and future workdays
    const allDays = weekDates.filter(date => {
      if (date < todayStr) return false; // skip past days
      const dow = new Date(date + 'T00:00:00').getDay();
      return workDays.includes(dow);
    });

    // Must-be-today check
    const mustBeToday = (
      task.flagged_for_today && task.deadline && task.deadline <= todayStr
    );

    const preferredDays: string[] = [];
    if (task.flagged_for_today && allDays.includes(todayStr)) {
      preferredDays.push(todayStr);
    }
    if (task.deadline && allDays.includes(task.deadline) && !preferredDays.includes(task.deadline)) {
      preferredDays.push(task.deadline);
    }

    // Theme-aware day scoring: client tasks prefer "Client Day", creative prefer "Deep Work", etc.
    const remainingDays = allDays.filter(d => !preferredDays.includes(d));
    remainingDays.sort((a, b) => {
      const aIdx = getDayIndex(a);
      const bIdx = getDayIndex(b);
      const aThemeScore = getThemeScore(themeMap[aIdx], task);
      const bThemeScore = getThemeScore(themeMap[bIdx], task);
      if (aThemeScore !== bThemeScore) return bThemeScore - aThemeScore; // higher score first
      // Then by least loaded
      const aLoad = (periodLoad[initKey(a, 'morning')] || 0) + (periodLoad[initKey(a, 'afternoon')] || 0) + (periodLoad[initKey(a, 'evening')] || 0);
      const bLoad = (periodLoad[initKey(b, 'morning')] || 0) + (periodLoad[initKey(b, 'afternoon')] || 0) + (periodLoad[initKey(b, 'evening')] || 0);
      return aLoad - bLoad;
    });

    const targetDays = mustBeToday ? [todayStr] : [...preferredDays, ...remainingDays];

    // Determine period preferences based on energy + weight
    const energyPref = ENERGY_PERIOD_PREF[energy] || ENERGY_PERIOD_PREF.admin;
    const weightPref = WEIGHT_PERIOD_PREF[weight] || WEIGHT_PERIOD_PREF.medium;

    // Merge: energy preference takes priority, weight breaks ties
    const basePeriodOrder = mergePreferences(energyPref, weightPref);

    let placed = false;
    for (const date of targetDays) {
      // Filter out periods that have already passed (for today only)
      const availablePeriods = getAvailablePeriodsForDate(date);
      const periodOrder = basePeriodOrder.filter(p => availablePeriods.includes(p));
      if (periodOrder.length === 0) continue;

      for (const period of periodOrder) {
        const key = initKey(date, period);
        if ((periodLoad[key] || 0) + mlu <= periodBudget[period]) {
          periodLoad[key] = (periodLoad[key] || 0) + mlu;
          suggestions.push({
            taskId: task.id,
            taskTitle: task.title,
            date,
            period,
            reasoning: buildReasoning(task, date, period, themeMap, todayStr),
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // If no period had budget, place in least-loaded period of best day
    if (!placed && targetDays.length > 0) {
      const bestDay = targetDays[0];
      const fallbackPeriods = getAvailablePeriodsForDate(bestDay);
      const bestPeriod = fallbackPeriods.reduce((best, p) => {
        const key = initKey(bestDay, p);
        const bestKey = initKey(bestDay, best);
        return (periodLoad[key] || 0) < (periodLoad[bestKey] || 0) ? p : best;
      });
      const key = initKey(bestDay, bestPeriod);
      periodLoad[key] = (periodLoad[key] || 0) + mlu;
      suggestions.push({
        taskId: task.id,
        taskTitle: task.title,
        date: bestDay,
        period: bestPeriod,
        reasoning: buildReasoning(task, bestDay, bestPeriod, themeMap, todayStr),
      });
    }
  }

  return suggestions;
}

// ━━━ Helpers ━━━

function parseTimeBlockToPeriod(timeBlock: string | null): TimePeriod {
  if (!timeBlock) return 'morning';
  if (timeBlock === 'morning' || timeBlock === 'afternoon' || timeBlock === 'evening') return timeBlock;
  const hour = parseInt(timeBlock.includes(':') ? timeBlock.split(':')[0] : timeBlock, 10);
  if (isNaN(hour) || hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getDayIndex(dateStr: string): number {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return dow === 0 ? 6 : dow - 1; // Convert Sun=0 → 6, Mon=1 → 0
}

function getThemeScore(theme: string | undefined, task: Task): number {
  if (!theme) return 0;
  const t = theme.toLowerCase();
  if (t.includes('client') && task.client_id) return 3;
  if (t.includes('deep work') && task.energy === 'creative' && task.weight === 'high') return 3;
  if (t.includes('content') && task.category === 'content') return 3;
  if (t.includes('admin') && task.energy === 'admin') return 2;
  if (t.includes('strategy') && task.category === 'strategy') return 2;
  if (t.includes('light') && task.weight === 'low') return 2;
  if (t.includes('off') || t.includes('recovery')) return -5; // avoid scheduling on off days
  return 0;
}

function mergePreferences(energyPref: TimePeriod[], weightPref: TimePeriod[]): TimePeriod[] {
  // Energy preference drives the order; weight is a tiebreaker
  const seen = new Set<TimePeriod>();
  const result: TimePeriod[] = [];
  for (const p of energyPref) {
    if (!seen.has(p)) { seen.add(p); result.push(p); }
  }
  for (const p of weightPref) {
    if (!seen.has(p)) { seen.add(p); result.push(p); }
  }
  return result;
}

function buildReasoning(
  task: Task,
  date: string,
  period: TimePeriod,
  themeMap: Record<number, string>,
  todayStr: string
): string {
  const parts: string[] = [];
  const energy = task.energy || 'admin';
  const weight = task.weight || 'medium';

  // Energy match reasoning
  const ideal = ENERGY_PERIOD_MAP[period];
  if (ideal && energy === ideal.ideal_energy && ideal.ideal_weights.includes(weight)) {
    parts.push(`${energy === 'creative' ? 'Creative' : 'Admin'} task placed in optimal ${period} slot`);
  } else if (period === 'morning' && energy === 'creative') {
    parts.push('Creative task in peak morning window');
  } else {
    parts.push(`${weight}-weight ${energy} task → ${period}`);
  }

  // Deadline reasoning
  if (task.deadline === date) {
    parts.push('deadline is this day');
  }

  // Today reasoning
  if (task.flagged_for_today && date === todayStr) {
    parts.push('flagged for today');
  }

  // Urgent reasoning
  if (task.is_urgent) {
    parts.push('urgent');
  }

  // Theme reasoning
  const dayIdx = getDayIndex(date);
  const theme = themeMap[dayIdx];
  if (theme) {
    const score = getThemeScore(theme, task);
    if (score >= 2) parts.push(`matches "${theme}" theme`);
  }

  return parts.join(' · ');
}
