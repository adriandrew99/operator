import { createClient } from '@/lib/supabase/server';
import { getToday } from '@/lib/utils/date';
import { getTodayScore, getScoreHistory, getScoreStats, getStreakDays } from '@/actions/score';
import { getCustomFundamentals, getTodayCompletions } from '@/actions/fundamentals';
import { calculateDailyLoad, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import { ScoreDashboard } from './ScoreDashboard';

export const dynamic = 'force-dynamic';

export default async function ScorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const today = getToday();

  const [
    todayScore,
    scoreHistory,
    scoreStats,
    streakDays,
    customFundamentals,
    fundamentalCompletions,
    todayTasksRes,
    completedTodayRes,
    profileRes,
  ] = await Promise.all([
    getTodayScore().catch(() => null),
    getScoreHistory(30).catch(() => []),
    getScoreStats().catch(() => null),
    getStreakDays().catch(() => 0),
    getCustomFundamentals().catch(() => []),
    getTodayCompletions().catch(() => []),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .or(`flagged_for_today.eq.true,deadline.lte.${today}`)
      .then(res => res.error ? supabase.from('tasks').select('*').eq('user_id', user.id).eq('status', 'active').lte('deadline', today) : res),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', today + 'T00:00:00'),
    Promise.resolve(
      supabase.from('profiles').select('daily_mlu_capacity').eq('id', user.id).single()
    ).catch(() => ({ data: null })),
  ]);

  const todayTasks = todayTasksRes.data || [];
  const completedTasks = completedTodayRes.data || [];
  const capacity = profileRes?.data?.daily_mlu_capacity ?? DAILY_CAPACITY;

  // Calculate today's auto metrics for display
  const allTasks = [...todayTasks, ...completedTasks];
  const nonPersonalTasks = allTasks.filter((t: { is_personal: boolean }) => !t.is_personal);
  const completedNonPersonal = completedTasks.filter((t: { is_personal: boolean }) => !t.is_personal);

  const completionsMap: Record<string, boolean> = {};
  fundamentalCompletions.forEach((c) => {
    completionsMap[c.fundamental_id] = c.completed;
  });
  const fundamentalsHit = customFundamentals.filter(f => completionsMap[f.id]).length;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-page-title text-text-primary">Operator Score</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Your daily performance composite. Auto-tracked metrics + self-assessment.
        </p>
      </div>

      <ScoreDashboard
        todayScore={todayScore}
        scoreHistory={scoreHistory}
        scoreStats={scoreStats}
        streakDays={streakDays}
        autoMetrics={{
          tasksCompleted: completedNonPersonal.length,
          tasksTotal: nonPersonalTasks.length,
          mluDelivered: calculateDailyLoad(completedNonPersonal),
          mluCapacity: capacity,
          fundamentalsHit,
          fundamentalsTotal: customFundamentals.length,
        }}
      />
    </div>
  );
}
