import { createClient } from '@/lib/supabase/server';
import { getProjectEnergyBreakdown, getClientEfficiency, getWeeklyCompletionTrend } from '@/actions/analytics';
import { getClientsWithOverrides } from '@/actions/finance';
import { getClientEnergyProfiles, getRevenueTrends, getEnergyTrends, generateAnalyticsInsights, getWeeklyDebrief, detectPatterns } from '@/actions/insights';
import type { DashboardLayoutPreferences } from '@/lib/types/dashboard-layout';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/lib/types/dashboard-layout';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    projectEnergy,
    clientEfficiency,
    weeklyTrend,
    clients,
    clientEnergyProfiles,
    revenueTrends,
    energyTrends,
    insights,
    weeklyDebrief,
    patterns,
    profileRes,
  ] = await Promise.all([
    getProjectEnergyBreakdown().catch(() => []),
    getClientEfficiency().catch(() => []),
    getWeeklyCompletionTrend().catch(() => []),
    getClientsWithOverrides().catch(() => []),
    getClientEnergyProfiles().catch(() => []),
    getRevenueTrends().catch(() => []),
    getEnergyTrends().catch(() => []),
    generateAnalyticsInsights().catch(() => []),
    getWeeklyDebrief().catch(() => null),
    detectPatterns().catch(() => []),
    user ? Promise.resolve(supabase.from('profiles').select('daily_mlu_capacity').eq('id', user.id).single()).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
  ]);

  // Read dashboard layout from user metadata (no extra DB call)
  const storedLayout = user?.user_metadata?.dashboard_layout;
  const dashboardLayout: DashboardLayoutPreferences = storedLayout
    ? { today: { ...DEFAULT_DASHBOARD_LAYOUT.today, ...storedLayout.today }, analytics: { ...DEFAULT_DASHBOARD_LAYOUT.analytics, ...storedLayout.analytics } }
    : DEFAULT_DASHBOARD_LAYOUT;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
        <p className="text-xs text-text-tertiary mt-0.5">Energy, revenue, and efficiency insights</p>
      </div>
      <AnalyticsDashboard
        projectEnergy={projectEnergy}
        clientEfficiency={clientEfficiency}
        weeklyTrend={weeklyTrend}
        clients={clients || []}
        clientEnergyProfiles={clientEnergyProfiles}
        revenueTrends={revenueTrends}
        energyTrends={energyTrends}
        insights={insights}
        weeklyDebrief={weeklyDebrief}
        patterns={patterns}
        dailyCapacity={profileRes?.data?.daily_mlu_capacity ?? undefined}
        dashboardLayout={dashboardLayout}
      />
    </div>
  );
}
