import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getCalendarEvents, getScheduledTasks, getCompletedScheduledTasks } from '@/actions/calendar';
import { getWeeklyGoals, getDayThemes } from '@/actions/planner';
import { WeekStrategyBoard } from '@/components/planner/WeekStrategyBoard';

export const dynamic = 'force-dynamic';

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const weekParam = params.week;

  // Calculate week bounds from param or default to current week
  let weekStart: string;
  let weekEnd: string;

  if (weekParam) {
    const d = new Date(weekParam + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset);
    weekStart = d.toISOString().split('T')[0];
    const sun = new Date(d);
    sun.setDate(d.getDate() + 6);
    weekEnd = sun.toISOString().split('T')[0];
  } else {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    weekStart = monday.toISOString().split('T')[0];
    weekEnd = sunday.toISOString().split('T')[0];
  }

  const [
    calendarEvents,
    scheduledTasks,
    completedScheduledTasks,
    allActiveTasksRes,
    clientsRes,
    profileRes,
    weeklyGoals,
    dayThemes,
  ] = await Promise.all([
    getCalendarEvents(weekStart, weekEnd).catch(() => []),
    getScheduledTasks(weekStart, weekEnd).catch(() => []),
    getCompletedScheduledTasks(weekStart, weekEnd).catch(() => []),
    Promise.resolve(
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
    ).catch(() => ({ data: [] })),
    Promise.resolve(
      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name', { ascending: true })
    ).catch(() => ({ data: [] })),
    Promise.resolve(supabase.from('profiles').select('daily_mlu_capacity').eq('id', user.id).single()).catch(() => ({ data: null })),
    getWeeklyGoals(weekStart).catch(() => []),
    getDayThemes(weekStart).catch(() => []),
  ]);

  const allTasks = allActiveTasksRes.data || [];
  const clientsList = clientsRes.data || [];
  const scheduledTaskIds = new Set(scheduledTasks.map((t: { id: string }) => t.id));
  const unscheduledTasks = allTasks.filter((t: { id: string }) => !scheduledTaskIds.has(t.id));

  return (
    <div className="space-y-6">
      <WeekStrategyBoard
        weekStart={weekStart}
        tasks={allTasks}
        scheduledTasks={scheduledTasks}
        completedScheduledTasks={completedScheduledTasks}
        unscheduledTasks={unscheduledTasks}
        calendarEvents={calendarEvents}
        clients={clientsList}
        dailyCapacity={profileRes?.data?.daily_mlu_capacity ?? undefined}
        weeklyGoals={weeklyGoals}
        dayThemes={dayThemes}
      />
    </div>
  );
}
