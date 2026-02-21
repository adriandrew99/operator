'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getToday } from '@/lib/utils/date';
import { calculateOperatorScoreV2 } from '@/lib/utils/score';
import { calculateDailyLoad, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import type { CheckInRatings, OperatorScore } from '@/lib/types/database';

// ━━━ Save Check-In ━━━

export async function saveCheckIn(
  ratings: CheckInRatings,
  notes?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = getToday();

  // Fetch auto metrics server-side
  const [tasksRes, completedRes, fundamentalsRes, completionsRes, profileRes, streakDays] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .or(`flagged_for_today.eq.true,deadline.lte.${today}`),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', today + 'T00:00:00'),
    supabase
      .from('custom_fundamentals')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('fundamental_completions')
      .select('fundamental_id, completed')
      .eq('user_id', user.id)
      .eq('date', today),
    Promise.resolve(
      supabase.from('profiles').select('daily_mlu_capacity').eq('id', user.id).single()
    ).catch(() => ({ data: null })),
    getStreakDaysInternal(supabase, user.id),
  ]);

  const todayTasks = tasksRes.data || [];
  const completedTasks = completedRes.data || [];
  const fundamentals = fundamentalsRes.data || [];
  const completions = completionsRes.data || [];
  const capacity = profileRes?.data?.daily_mlu_capacity ?? DAILY_CAPACITY;

  const completedIds = new Set(completions.filter((c: any) => c.completed).map((c: any) => c.fundamental_id));
  const fundamentalsHit = fundamentals.filter((f: any) => completedIds.has(f.id)).length;

  // Calculate all tasks for today (active + completed)
  const allTasks = [...todayTasks, ...completedTasks];
  const nonPersonalTasks = allTasks.filter((t: any) => !t.is_personal);
  const completedNonPersonal = completedTasks.filter((t: any) => !t.is_personal);

  const result = calculateOperatorScoreV2({
    tasksCompleted: completedNonPersonal.length,
    tasksTotal: nonPersonalTasks.length,
    mluDelivered: calculateDailyLoad(completedNonPersonal),
    mluCapacity: capacity,
    fundamentalsHit,
    fundamentalsTotal: fundamentals.length,
    streakDays,
    checkIn: ratings,
  });

  const { error } = await supabase
    .from('operator_scores')
    .upsert(
      {
        user_id: user.id,
        date: today,
        score: result.score,
        breakdown: result.breakdown,
        check_in: ratings,
        notes: notes || null,
        version: 2,
      },
      { onConflict: 'user_id,date' }
    );

  if (error) throw error;

  revalidatePath('/today');
  revalidatePath('/score');
}

// ━━━ Recalculate Auto Score ━━━
// Called when tasks/fundamentals change. Preserves existing check-in if present.

export async function recalculateAutoScore() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // silently skip if not authenticated

  const today = getToday();

  const [existingRes, tasksRes, completedRes, fundamentalsRes, completionsRes, profileRes] = await Promise.all([
    supabase
      .from('operator_scores')
      .select('check_in, notes')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .or(`flagged_for_today.eq.true,deadline.lte.${today}`),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', today + 'T00:00:00'),
    supabase
      .from('custom_fundamentals')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('fundamental_completions')
      .select('fundamental_id, completed')
      .eq('user_id', user.id)
      .eq('date', today),
    Promise.resolve(
      supabase.from('profiles').select('daily_mlu_capacity').eq('id', user.id).single()
    ).catch(() => ({ data: null })),
  ]);

  const existing = existingRes.data;
  const todayTasks = tasksRes.data || [];
  const completedTasks = completedRes.data || [];
  const fundamentals = fundamentalsRes.data || [];
  const completions = completionsRes.data || [];
  const capacity = profileRes?.data?.daily_mlu_capacity ?? DAILY_CAPACITY;

  const completedIds = new Set(completions.filter((c: any) => c.completed).map((c: any) => c.fundamental_id));
  const fundamentalsHit = fundamentals.filter((f: any) => completedIds.has(f.id)).length;

  const allTasks = [...todayTasks, ...completedTasks];
  const nonPersonalTasks = allTasks.filter((t: any) => !t.is_personal);
  const completedNonPersonal = completedTasks.filter((t: any) => !t.is_personal);

  // Get streak — use internal function to avoid extra auth call
  const streakDays = await getStreakDaysInternal(supabase, user.id);

  // Preserve existing check-in if user already checked in today
  const checkIn = existing?.check_in as CheckInRatings | null ?? null;

  const result = calculateOperatorScoreV2({
    tasksCompleted: completedNonPersonal.length,
    tasksTotal: nonPersonalTasks.length,
    mluDelivered: calculateDailyLoad(completedNonPersonal),
    mluCapacity: capacity,
    fundamentalsHit,
    fundamentalsTotal: fundamentals.length,
    streakDays,
    checkIn,
  });

  await supabase
    .from('operator_scores')
    .upsert(
      {
        user_id: user.id,
        date: today,
        score: result.score,
        breakdown: result.breakdown,
        check_in: checkIn,
        notes: existing?.notes || null,
        version: 2,
      },
      { onConflict: 'user_id,date' }
    );

  // Don't revalidate here — the caller's server action already revalidates
}

// ━━━ Get Today's Score ━━━

export async function getTodayScore(): Promise<OperatorScore | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('operator_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', getToday())
    .maybeSingle();

  return data as OperatorScore | null;
}

// ━━━ Score History ━━━

export async function getScoreHistory(days: number = 30) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('operator_scores')
    .select('date, score, breakdown, check_in, version')
    .eq('user_id', user.id)
    .gte('date', startStr)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ━━━ Score Stats ━━━

export async function getScoreStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('operator_scores')
    .select('date, score, breakdown, check_in, version')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(90);

  if (error || !data || data.length === 0) return null;

  // Personal best
  const personalBest = Math.max(...data.map(d => d.score));
  const personalBestDate = data.find(d => d.score === personalBest)?.date || '';

  // Weekly averages (last 4 weeks)
  const weeklyAverages: { weekStart: string; avg: number; count: number; checkedInCount: number }[] = [];
  const now = new Date();
  for (let w = 0; w < 4; w++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (w * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const weekScores = data.filter(d => d.date >= weekStartStr && d.date <= weekEndStr);
    if (weekScores.length > 0) {
      const avg = Math.round(weekScores.reduce((s, d) => s + d.score, 0) / weekScores.length);
      const checkedInCount = weekScores.filter(d => d.check_in !== null).length;
      weeklyAverages.push({ weekStart: weekStartStr, avg, count: weekScores.length, checkedInCount });
    }
  }

  // Longest streak (all-time from the data we have)
  let longestStreak = 0;
  let currentStreak = 0;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    const threshold = sorted[i].version === 2 ? 55 : 70;
    if (sorted[i].score >= threshold) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Dimension averages (V2 scores only)
  const v2Scores = data.filter(d => d.version === 2 && d.breakdown);
  const dimensionAvgs = v2Scores.length > 0 ? {
    execution: Math.round(v2Scores.reduce((s, d) => s + ((d.breakdown as any)?.execution || 0), 0) / v2Scores.length),
    habits: Math.round(v2Scores.reduce((s, d) => s + ((d.breakdown as any)?.habits || 0), 0) / v2Scores.length),
    focus: Math.round(v2Scores.reduce((s, d) => s + ((d.breakdown as any)?.focus || 0), 0) / v2Scores.length),
    energy: Math.round(v2Scores.reduce((s, d) => s + ((d.breakdown as any)?.energy || 0), 0) / v2Scores.length),
    decisions: Math.round(v2Scores.reduce((s, d) => s + ((d.breakdown as any)?.decisions || 0), 0) / v2Scores.length),
    momentum: Math.round(v2Scores.reduce((s, d) => s + ((d.breakdown as any)?.momentum || 0), 0) / v2Scores.length),
  } : null;

  // Check-in rate
  const last30 = data.slice(0, 30);
  const checkInRate = last30.length > 0
    ? Math.round((last30.filter(d => d.check_in !== null).length / last30.length) * 100)
    : 0;

  return {
    personalBest,
    personalBestDate,
    longestStreak,
    weeklyAverages,
    dimensionAvgs,
    checkInRate,
    totalDays: data.length,
  };
}

// ━━━ Streak (version-aware) ━━━

export async function getStreakDays(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  return getStreakDaysInternal(supabase, user.id);
}

async function getStreakDaysInternal(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from('operator_scores')
    .select('date, score, version')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);

  if (!data || data.length === 0) return 0;

  let streak = 0;
  const today = new Date(getToday());

  for (let i = 0; i < data.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i - 1);
    const expectedStr = expectedDate.toISOString().split('T')[0];

    // Version-aware threshold: v2 scores max at 55 without check-in, so 55 is the threshold
    const threshold = data[i].version === 2 ? 55 : 70;

    if (data[i].date === expectedStr && data[i].score >= threshold) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
