import { createClient } from '@/lib/supabase/server';
import { getToday } from '@/lib/utils/date';
import { formatDateLong } from '@/lib/utils/date';
import { getCustomFundamentals, getTodayCompletions } from '@/actions/fundamentals';
import { getClientsWithOverrides } from '@/actions/finance';
import { getTasksForWeek } from '@/actions/tasks';
import { getRecurringStreaks } from '@/actions/recurring';
import { isWeeklyDebriefReady } from '@/actions/insights';
import { getExternalCalendarEvents } from '@/actions/external-calendar';
import { getTodayScore } from '@/actions/score';
import { getPinnedNote } from '@/actions/pinned-notes';
import { TodayDashboard } from './TodayDashboard';
import { DebriefBanner } from '@/components/insights/DebriefBanner';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const today = getToday();

  // Get day of week (0=Sunday, 1=Monday, etc.)
  const dayOfWeek = new Date().getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Pre-calculate week bounds for parallel fetch
  const dayOfWeekNum = new Date().getDay();
  const mondayOffset = dayOfWeekNum === 0 ? -6 : 1 - dayOfWeekNum;
  const mondayDate = new Date();
  mondayDate.setDate(mondayDate.getDate() + mondayOffset);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  const weekStart = mondayDate.toISOString().split('T')[0];
  const weekEnd = sundayDate.toISOString().split('T')[0];

  // Single parallel fetch — no waterfalls
  const [
    scoresRes,
    recurringRes,
    completionsRes,
    customFundamentals,
    fundamentalCompletions,
    todayTasksRes,
    clients,
    weekTasks,
    completedTodayRes,
    profileRes,
    debriefReady,
    calendarEventsRes,
    recurringStreaks,
    todayScore,
    pinnedNote,
  ] = await Promise.all([
    supabase
      .from('operator_scores')
      .select('date, score')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30),
    supabase
      .from('recurring_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('recurring_task_completions')
      .select('recurring_task_id')
      .eq('user_id', user.id)
      .eq('date', today),
    getCustomFundamentals().catch(() => []),
    getTodayCompletions().catch(() => []),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .or(`flagged_for_today.eq.true,deadline.lte.${today}`)
      .order('sort_order', { ascending: true })
      .then(res => {
        // If flagged_for_today column doesn't exist, fall back to deadline-only query
        if (res.error) {
          return supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .lte('deadline', today)
            .order('sort_order', { ascending: true });
        }
        return res;
      }),
    getClientsWithOverrides().catch(() => []),
    getTasksForWeek(weekStart, weekEnd).catch(() => []),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', today + 'T00:00:00')
      .order('completed_at', { ascending: false }),
    Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).single()).catch(() => ({ data: null })),
    isWeeklyDebriefReady().catch(() => false),
    Promise.resolve(supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .or(`date.eq.${today},and(is_recurring.eq.true)`)
      .order('start_time', { ascending: true })
    ).catch(() => ({ data: [] })),
    getRecurringStreaks().catch(() => ({} as Record<string, number>)),
    getTodayScore().catch(() => null),
    getPinnedNote().catch(() => null),
  ]);

  // Build recurring tasks with today's completion status
  const completedTaskIds = new Set((completionsRes.data || []).map((c) => c.recurring_task_id));
  const allRecurringTasks = (recurringRes.data || []).map((t) => ({
    ...t,
    completedToday: completedTaskIds.has(t.id),
  }));
  const recurringTasks = allRecurringTasks.filter((t) => {
    if (t.frequency === 'daily') return true;
    if (t.frequency === 'weekdays') return isWeekday;
    if (t.frequency === 'weekly') return t.day_of_week === dayOfWeek;
    if (t.frequency === 'custom' && t.days_of_week) return t.days_of_week.includes(dayOfWeek);
    return true;
  });

  // Calculate streak
  let streak = 0;
  const scores = scoresRes.data || [];
  const todayDate = new Date(today);
  for (let i = 0; i < scores.length; i++) {
    const expectedDate = new Date(todayDate);
    expectedDate.setDate(todayDate.getDate() - i - 1);
    const expectedStr = expectedDate.toISOString().split('T')[0];
    if (scores[i].date === expectedStr && scores[i].score >= 70) {
      streak++;
    } else {
      break;
    }
  }

  // Build completions map for fundamentals
  const completionsMap: Record<string, boolean> = {};
  fundamentalCompletions.forEach((c) => {
    completionsMap[c.fundamental_id] = c.completed;
  });

  // Filter calendar events: include exact date matches + recurring events for today's day of week
  const internalEvents = ((calendarEventsRes as { data: unknown[] | null })?.data || []).filter((e: unknown) => {
    const event = e as { date: string; is_recurring?: boolean; recurrence_days?: number[] | null };
    if (event.date === today) return true;
    if (event.is_recurring && event.recurrence_days?.includes(dayOfWeek)) return true;
    return false;
  });

  // Also fetch external calendar events (iCal feed) — completely non-blocking
  // Uses AbortController to ensure a hard 3s cutoff even if the function internally hangs
  let externalEvents: Awaited<ReturnType<typeof getExternalCalendarEvents>> = [];
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 3000);
    externalEvents = await Promise.race([
      getExternalCalendarEvents(today).catch(() => [] as typeof externalEvents),
      new Promise<typeof externalEvents>((resolve) => {
        ac.signal.addEventListener('abort', () => resolve([]));
      }),
    ]);
    clearTimeout(timeout);
  } catch { /* ignore — calendar is non-critical */ }

  // Merge: convert external events to CalendarEvent shape for the overview panel
  const externalAsCalendar = externalEvents.map(e => ({
    id: e.id,
    user_id: user.id,
    title: e.title,
    date: today,
    start_time: e.allDay ? '00:00' : new Date(e.start).toTimeString().slice(0, 5),
    end_time: e.allDay ? '23:59' : new Date(e.end).toTimeString().slice(0, 5),
    event_type: 'fixed' as const,
    is_recurring: false,
    recurrence_days: null,
    color: e.calendarColor || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const calendarEvents = [...internalEvents, ...externalAsCalendar];

  // Compute confirmed MRR from active clients with retainers
  // Only exclude clients whose termination_date is before this month (matches Finance page logic)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const confirmedMRR = (clients || [])
    .filter((c: { is_active?: boolean; termination_date?: string | null; retainer_amount?: number | null; contract_start?: string | null }) => {
      if (!c.is_active || !c.retainer_amount) return false;
      if (c.termination_date) {
        const termDate = new Date(c.termination_date + 'T12:00:00');
        if (termDate < thisMonthStart) return false;
      }
      if (c.contract_start) {
        const startDate = new Date(c.contract_start + 'T12:00:00');
        if (startDate > thisMonthStart) return false;
      }
      return true;
    })
    .reduce((sum: number, c: { retainer_amount?: number | null }) => sum + (c.retainer_amount || 0), 0);

  // Auto-sync: create virtual today-tasks from recurring tasks due today
  // These appear in the main Today's Plan so completion syncs across both views
  const recurringAsTodayTasks = recurringTasks.map((rt) => ({
    id: `recurring-${rt.id}`,
    user_id: user.id,
    title: `${rt.title}`,
    description: rt.description || null,
    category: rt.category || 'admin',
    weight: rt.weight || 'low',
    energy: rt.energy || 'admin',
    estimated_minutes: rt.estimated_minutes || null,
    deadline: null,
    status: rt.completedToday ? 'completed' as const : 'active' as const,
    flagged_for_today: true,
    sort_order: 999,
    client_id: rt.client_id || null,
    is_urgent: false,
    is_personal: false,
    scheduled_day: null,
    scheduled_hour: null,
    completed_at: rt.completedToday ? today + 'T00:00:00' : null,
    created_at: rt.created_at,
    updated_at: rt.updated_at,
    _recurring_task_id: rt.id,
  }));

  // Merge: real tasks first, then recurring-as-tasks (only ACTIVE ones, not already a task with same title)
  const existingTitles = new Set((todayTasksRes.data || []).map(t => t.title));
  const mergedTodayTasks = [
    ...(todayTasksRes.data || []),
    ...recurringAsTodayTasks.filter(rt => rt.status === 'active' && !existingTitles.has(rt.title)),
  ];

  const mergedCompletedTasks = [
    ...completedTodayRes.data || [],
    ...recurringAsTodayTasks.filter(rt => rt.status === 'completed'),
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between max-w-3xl">
        <div>
          <h1 className="text-page-title text-text-primary">Today</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {formatDateLong(today)}
          </p>
        </div>
      </div>

      {/* Weekly Debrief notification — dismissable, disappears after click */}
      {debriefReady && <DebriefBanner />}

      <TodayDashboard
        customFundamentals={customFundamentals || []}
        fundamentalCompletions={completionsMap}
        streakDays={streak}
        recurringTasks={recurringTasks}
        allRecurringTasks={allRecurringTasks}
        todayTasks={mergedTodayTasks}
        completedTodayTasks={mergedCompletedTasks}
        weekTasks={weekTasks || []}
        today={today}
        clients={clients || []}
        dailyCapacity={profileRes?.data?.daily_mlu_capacity ?? undefined}
        calendarEvents={calendarEvents as import('@/lib/types/database').CalendarEvent[]}
        recurringStreaks={recurringStreaks as Record<string, number>}
        todayScore={todayScore}
        pinnedNote={pinnedNote}
        confirmedMRR={confirmedMRR}
      />
    </div>
  );
}
