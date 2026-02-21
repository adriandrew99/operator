import { createClient } from '@/lib/supabase/server';
import { getProjectEnergyBreakdown, getClientEfficiency, getWeeklyCompletionTrend } from '@/actions/analytics';
import { getClientsWithOverrides } from '@/actions/finance';
import { getClientEnergyProfiles, getRevenueTrends, getEnergyTrends, generateAnalyticsInsights, getWeeklyDebrief, detectPatterns, getMonthlyTrends, getClientHealthScores, getScopeCreepAnalysis } from '@/actions/insights';
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
    monthlyTrends,
    clientHealthScores,
    profileRes,
    scopeCreepAnalysis,
  ] = await Promise.all([
    getProjectEnergyBreakdown().catch((e) => { console.error('[Analytics] projectEnergy failed:', e.message); return []; }),
    getClientEfficiency().catch((e) => { console.error('[Analytics] clientEfficiency failed:', e.message); return []; }),
    getWeeklyCompletionTrend().catch((e) => { console.error('[Analytics] weeklyTrend failed:', e.message); return []; }),
    getClientsWithOverrides().catch((e) => { console.error('[Analytics] clients failed:', e.message); return []; }),
    getClientEnergyProfiles().catch((e) => { console.error('[Analytics] clientEnergyProfiles failed:', e.message); return []; }),
    getRevenueTrends().catch((e) => { console.error('[Analytics] revenueTrends failed:', e.message); return []; }),
    getEnergyTrends().catch((e) => { console.error('[Analytics] energyTrends failed:', e.message); return []; }),
    generateAnalyticsInsights().catch((e) => { console.error('[Analytics] insights failed:', e.message); return []; }),
    getWeeklyDebrief().catch((e) => { console.error('[Analytics] weeklyDebrief failed:', e.message); return null; }),
    detectPatterns().catch((e) => { console.error('[Analytics] patterns failed:', e.message); return []; }),
    getMonthlyTrends().catch((e) => { console.error('[Analytics] monthlyTrends failed:', e.message); return []; }),
    getClientHealthScores().catch((e) => { console.error('[Analytics] clientHealthScores failed:', e.message); return []; }),
    user ? Promise.resolve(supabase.from('profiles').select('daily_mlu_capacity').eq('id', user.id).single()).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
    getScopeCreepAnalysis().catch((e) => { console.error('[Analytics] scopeCreepAnalysis failed:', e.message); return null; }),
  ]);

  // Read dashboard layout from user metadata (no extra DB call)
  const storedLayout = user?.user_metadata?.dashboard_layout;
  const dashboardLayout: DashboardLayoutPreferences = storedLayout
    ? { today: { ...DEFAULT_DASHBOARD_LAYOUT.today, ...storedLayout.today }, analytics: { ...DEFAULT_DASHBOARD_LAYOUT.analytics, ...storedLayout.analytics } }
    : DEFAULT_DASHBOARD_LAYOUT;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title text-text-primary">Analytics</h1>
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
        monthlyTrends={monthlyTrends}
        clientHealthScores={clientHealthScores}
        dailyCapacity={profileRes?.data?.daily_mlu_capacity ?? undefined}
        dashboardLayout={dashboardLayout}
        scopeCreepAnalysis={scopeCreepAnalysis}
      />
    </div>
  );
}
