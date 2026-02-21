import { createClient } from '@/lib/supabase/server';
import { getCustomFundamentals } from '@/actions/fundamentals';
import { getTaskMLU } from '@/lib/utils/mental-load';
import { getCalendarSources } from '@/actions/external-calendar';
import { getDashboardLayout } from '@/actions/settings';
import { getSlackWebhookUrl } from '@/actions/slack';
import { getCalendarFeedUrl } from '@/actions/calendar-feed';
import { SettingsDashboard } from './SettingsDashboard';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 30 days ago for history query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [profileRes, goalsRes, fundamentals, completedTasksRes, calendarSources, dashboardLayout, slackWebhookUrl, calendarFeedUrl] = await Promise.all([
    Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).single()).catch(() => ({ data: null })),
    Promise.resolve(supabase
      .from('identity_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })).catch(() => ({ data: [] })),
    getCustomFundamentals().catch(() => []),
    Promise.resolve(supabase
      .from('tasks')
      .select('completed_at, weight, energy')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgoStr + 'T00:00:00')
    ).catch(() => ({ data: [] })),
    getCalendarSources().catch(() => []),
    getDashboardLayout().catch(() => undefined),
    getSlackWebhookUrl().catch(() => null),
    getCalendarFeedUrl().catch(() => null),
  ]);

  // Group completed tasks by day and sum MLU
  const completionByDay = new Map<string, number>();
  (completedTasksRes.data || []).forEach((task: { completed_at: string | null; weight: string; energy: string }) => {
    if (!task.completed_at) return;
    const day = task.completed_at.split('T')[0];
    const mlu = getTaskMLU({ weight: task.weight as 'low' | 'medium' | 'high', energy: task.energy as 'admin' | 'creative' });
    completionByDay.set(day, (completionByDay.get(day) || 0) + mlu);
  });

  const completionHistory = Array.from(completionByDay.entries()).map(([date, totalMLU]) => ({
    date,
    totalMLU,
  }));

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
      />
    </div>
  );
}
