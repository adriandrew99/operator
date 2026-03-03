import { createClient } from '@/lib/supabase/server';
import { getCustomFundamentals } from '@/actions/fundamentals';
import { getTaskMLU } from '@/lib/utils/mental-load';
import { getCalendarSources } from '@/actions/external-calendar';
import { getDashboardLayout } from '@/actions/settings';
import { getSlackWebhookUrl } from '@/actions/slack';
import { getCalendarFeedUrl } from '@/actions/calendar-feed';
import { getPushSubscriptions, getReminders } from '@/actions/notifications';
import { SettingsDashboard } from './SettingsDashboard';
import type { RecurringTask } from '@/lib/types/recurring';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 30 days ago for history query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [profileRes, goalsRes, fundamentals, completedTasksRes, recurringTasksRes, calendarSources, dashboardLayout, slackWebhookUrl, calendarFeedUrl, pushSubscriptions, reminders, clientsRes] = await Promise.all([
    Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).single()).catch(() => ({ data: null })),
    Promise.resolve(supabase
      .from('identity_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })).catch(() => ({ data: [] })),
    getCustomFundamentals().catch(() => []),
    // Completed tasks in the last 30 days — represents actual daily output
    Promise.resolve(supabase
      .from('tasks')
      .select('completed_at, weight, energy, is_personal')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgoStr + 'T00:00:00')
    ).catch(() => ({ data: [] })),
    // Active recurring tasks — these contribute MLU every working day
    Promise.resolve(supabase
      .from('recurring_tasks')
      .select('weight, energy, frequency, days_of_week, day_of_week')
      .eq('user_id', user.id)
      .eq('is_active', true)
    ).catch(() => ({ data: [] })),
    getCalendarSources().catch(() => []),
    getDashboardLayout().catch(() => undefined),
    getSlackWebhookUrl().catch(() => null),
    getCalendarFeedUrl().catch(() => null),
    getPushSubscriptions().catch(() => []),
    getReminders().catch(() => []),
    Promise.resolve(supabase
      .from('clients')
      .select('id, name')
      .eq('user_id', user.id)
      .is('termination_date', null)
      .order('name', { ascending: true })
    ).catch(() => ({ data: [] })),
  ]);

  // 1. Calculate recurring task baseline MLU (daily contribution)
  //    Weekday recurring tasks add to every weekday; daily tasks add every day
  const recurringTasks = (recurringTasksRes.data || []) as Pick<RecurringTask, 'weight' | 'energy' | 'frequency' | 'days_of_week' | 'day_of_week'>[];
  const weekdayRecurringMLU = recurringTasks
    .filter(rt => rt.frequency === 'daily' || rt.frequency === 'weekdays')
    .reduce((sum, rt) => sum + getTaskMLU({ weight: (rt.weight || 'medium') as 'low' | 'medium' | 'high', energy: (rt.energy || 'admin') as 'admin' | 'creative' }), 0);

  // 2. Group completed one-off tasks by day (excluding personal)
  const completedByDay = new Map<string, number>();
  (completedTasksRes.data || []).forEach((task: { completed_at: string | null; weight: string; energy: string; is_personal: boolean | null }) => {
    if (!task.completed_at || task.is_personal) return;
    const day = task.completed_at.split('T')[0];
    const mlu = getTaskMLU({ weight: task.weight as 'low' | 'medium' | 'high', energy: task.energy as 'admin' | 'creative' });
    completedByDay.set(day, (completedByDay.get(day) || 0) + mlu);
  });

  // 3. Build daily load = completed one-off tasks + recurring baseline for that day
  //    This mirrors what the Today page actually shows
  const completionHistory = Array.from(completedByDay.entries()).map(([date, oneOffMLU]) => {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sun, 6=Sat
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    // Add recurring baseline on weekdays (daily + weekday recurring tasks run on weekdays)
    const recurringBaseline = isWeekday ? weekdayRecurringMLU : 0;
    return { date, totalMLU: oneOffMLU + recurringBaseline };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title text-text-primary">Settings</h1>
        <p className="text-xs text-text-tertiary mt-0.5">Identity goals, fundamentals, and preferences</p>
      </div>
      <SettingsDashboard
        profile={profileRes.data}
        goals={goalsRes.data || []}
        fundamentals={fundamentals || []}
        userEmail={user.email || ''}
        completionHistory={completionHistory}
        calendarSources={calendarSources}
        dashboardLayout={dashboardLayout}
        slackWebhookUrl={slackWebhookUrl}
        calendarFeedUrl={calendarFeedUrl}
        pushSubscriptions={pushSubscriptions}
        reminders={reminders}
        clients={(clientsRes.data || []) as { id: string; name: string }[]}
      />
    </div>
  );
}
