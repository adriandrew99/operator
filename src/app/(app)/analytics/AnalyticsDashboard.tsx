'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { DAILY_CAPACITY } from '@/lib/utils/mental-load';
import { toCSV, downloadCSV, downloadJSON, fileDate } from '@/lib/utils/export';
import { RevenueRadar } from '@/components/insights/RevenueRadar';
import { WeeklyDebrief } from '@/components/insights/WeeklyDebrief';
import { ScopeCreepRadar } from '@/components/insights/ScopeCreepRadar';
import { LayoutCustomiser } from '@/components/layout/LayoutCustomiser';
import { ExportButton } from '@/components/ui/ExportButton';
import { InfoTip } from '@/components/ui/InfoTip';
import { TabBar } from '@/components/ui/TabBar';
import type { Client } from '@/lib/types/database';
import type { ClientEnergyProfile, RevenueInsight, RevenueTrend, EnergyTrend, WeeklyDebrief as WeeklyDebriefData, DetectedPattern, MonthlyTrend, ClientHealthScore, ScopeCreepAnalysis } from '@/actions/insights';
import type { DashboardLayoutPreferences } from '@/lib/types/dashboard-layout';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/lib/types/dashboard-layout';

interface ProjectEnergy {
  name: string;
  energy: number;
  taskCount: number;
  totalMinutes: number;
}

interface ClientEfficiency {
  name: string;
  energy: number;
  revenue: number;
  efficiency: number;
  isActive: boolean;
}

interface WeeklyTrend {
  week: string;
  count: number;
  energy: number;
}

interface AnalyticsDashboardProps {
  projectEnergy: ProjectEnergy[];
  clientEfficiency: ClientEfficiency[];
  weeklyTrend: WeeklyTrend[];
  clients: Client[];
  clientEnergyProfiles: ClientEnergyProfile[];
  revenueTrends: RevenueTrend[];
  energyTrends: EnergyTrend[];
  insights: RevenueInsight[];
  weeklyDebrief: WeeklyDebriefData | null;
  patterns: DetectedPattern[];
  monthlyTrends: MonthlyTrend[];
  clientHealthScores: ClientHealthScore[];
  scopeCreepAnalysis?: ScopeCreepAnalysis | null;
  debriefHistory?: { week_start: string; week_label: string; data: WeeklyDebriefData }[];
  dailyCapacity?: number;
  dashboardLayout?: DashboardLayoutPreferences;
}

// ━━━ Shared tooltip ━━━
interface TooltipPayloadItem { name?: string; value?: number; color?: string }
interface TooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: TooltipPayloadItem, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
              <span className="text-[11px] text-text-secondary">{entry.name}</span>
            </div>
            <span className="chart-tooltip-value">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ━━━ Severity styles ━━━
const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  positive: { bg: 'bg-surface-tertiary', border: 'border-border', icon: '↑', text: 'text-text-primary' },
  info:     { bg: 'bg-surface-tertiary', border: 'border-border', icon: '→', text: 'text-text-secondary' },
  warning:  { bg: 'bg-surface-tertiary', border: 'border-border', icon: '⚠', text: 'text-text-secondary' },
  danger:   { bg: 'bg-surface-tertiary', border: 'border-border', icon: '!', text: 'text-text-secondary' },
};

// ━━━ Collapsible Section Wrapper ━━━
function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface-secondary border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-surface-tertiary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <p className="text-xs font-medium text-text-tertiary">{title}</p>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn('text-text-tertiary transition-transform duration-300', open && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden',
          open ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 sm:px-6 pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard({
  projectEnergy,
  clientEfficiency: _clientEfficiency,
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
  scopeCreepAnalysis,
  debriefHistory = [],
  dailyCapacity,
  dashboardLayout,
}: AnalyticsDashboardProps) {
  const [liveLayout, setLiveLayout] = useState<DashboardLayoutPreferences>(dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT);
  const layout = liveLayout.analytics;
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const [clientSort, setClientSort] = useState<'efficiency' | 'revenue' | 'energy'>('efficiency');
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'trends' | 'data'>('overview');

  // ── Computed data ──
  const weeklyTrendFormatted = useMemo(() => {
    return weeklyTrend.map((w) => ({
      ...w,
      label: new Date(w.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }));
  }, [weeklyTrend]);

  // Derive revenue from clientEnergyProfiles (already includes overrides) — more
  // reliable than the separate clients array which can silently return [].
  // Fall back to clients array if profiles are empty (no tasks completed yet).
  const totalMonthlyRevenue = useMemo(() => {
    const fromProfiles = clientEnergyProfiles
      .filter(p => p.isActive)
      .reduce((s, p) => s + p.monthlyRevenue, 0);
    if (fromProfiles > 0) return fromProfiles;
    return clients.filter(c => c.is_active).reduce((s, c) => s + (c.retainer_amount || 0), 0);
  }, [clientEnergyProfiles, clients]);

  const totalMLUSpent = useMemo(() => {
    return clientEnergyProfiles.reduce((s, p) => s + p.totalMLU, 0);
  }, [clientEnergyProfiles]);

  const avgRevenuePerMLU = useMemo(() => {
    return totalMLUSpent > 0 ? Math.round((totalMonthlyRevenue / totalMLUSpent) * 100) / 100 : 0;
  }, [totalMonthlyRevenue, totalMLUSpent]);

  const efficiencyThresholds = useMemo(() => {
    const avg = avgRevenuePerMLU;
    if (avg <= 0) return { efficient: 100, average: 50 };
    return {
      efficient: Math.round(avg * 1.2 * 100) / 100,
      average: Math.round(avg * 0.6 * 100) / 100,
    };
  }, [avgRevenuePerMLU]);

  const totalTasksCompleted = useMemo(() => {
    return energyTrends.reduce((s, w) => s + w.taskCount, 0);
  }, [energyTrends]);

  const activeClientCount = useMemo(() => {
    // Prefer profiles (which include inactive clients with 0 tasks) for count
    const fromProfiles = clientEnergyProfiles.filter(p => p.isActive).length;
    if (fromProfiles > 0) return fromProfiles;
    return clients.filter(c => c.is_active).length;
  }, [clientEnergyProfiles, clients]);

  const monthlyCapacity = capacity * 22;
  const capacityUsedPct = monthlyCapacity > 0 ? Math.round((totalMLUSpent / monthlyCapacity) * 100) : 0;

  // Backward compat fallbacks for layout keys
  type LayoutWithLegacy = DashboardLayoutPreferences & { summary_cards?: boolean; energy_per_client?: boolean; insights?: boolean };
  const layoutWithLegacy = layout as LayoutWithLegacy;
  const showHero = layout.hero_section ?? layoutWithLegacy.summary_cards ?? true;
  const showClientEnergy = layout.client_energy_revenue ?? layoutWithLegacy.energy_per_client ?? true;
  const showInsightsPatterns = layout.insights_patterns ?? layoutWithLegacy.insights ?? true;

  // Sorted client profiles for Client Energy vs Revenue section
  const sortedProfiles = useMemo(() => {
    const profiles = [...clientEnergyProfiles];
    if (clientSort === 'efficiency') {
      profiles.sort((a, b) => b.revenuePerMLU - a.revenuePerMLU);
    } else if (clientSort === 'revenue') {
      profiles.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
    } else {
      profiles.sort((a, b) => b.totalMLU - a.totalMLU);
    }
    return profiles;
  }, [clientEnergyProfiles, clientSort]);

  // Combined insights + patterns sorted by severity
  const combinedInsights = useMemo(() => {
    const severityOrder: Record<string, number> = { danger: 0, warning: 1, info: 2, positive: 3 };
    const all: Array<{ type: 'insight' | 'pattern'; severity: string; title: string; detail: string; metric?: string; icon?: string; category?: string }> = [];
    insights.forEach(i => all.push({ type: 'insight', severity: i.severity, title: i.title, detail: i.detail, metric: i.metric }));
    patterns.forEach(p => all.push({ type: 'pattern', severity: p.severity, title: p.title, detail: p.detail, metric: p.metric, icon: p.icon, category: p.category }));
    all.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
    return all;
  }, [insights, patterns]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Analytics</h1>
          <p className="text-sm text-text-tertiary mt-0.5">Client energy, revenue efficiency, and trends</p>
        </div>
      </div>

      {/* ═══ Tabs + Layout Customiser + Export ═══ */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabBar
          tabs={[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'clients' as const, label: 'Clients' },
            { key: 'trends' as const, label: 'Trends' },
            { key: 'data' as const, label: 'Data' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
          className="flex-1 min-w-0"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
        <ExportButton options={[
          {
            label: 'Export Client Data (CSV)',
            description: 'Client profiles, efficiency, revenue',
            action: () => {
              const csv = toCSV(
                clientEnergyProfiles.map(p => ({
                  Client: p.name,
                  'Monthly Revenue': p.monthlyRevenue,
                  'Total MLU': p.totalMLU,
                  Tasks: p.taskCount,
                  'Revenue/MLU': p.revenuePerMLU,
                  'Creative Tasks': p.energyMix.creative,
                  'Admin Tasks': p.energyMix.admin,
                  Active: p.isActive ? 'Yes' : 'No',
                  'Risk Flag': p.riskFlag || 'None',
                }))
              );
              downloadCSV(csv, `nexus-clients-${fileDate()}.csv`);
            },
          },
          {
            label: 'Export Weekly Trends (CSV)',
            description: 'Energy investment over 12 weeks',
            action: () => {
              const csv = toCSV(
                energyTrends.map(w => ({
                  Week: w.label,
                  'Total MLU': Math.round(w.totalMLU * 10) / 10,
                  'Admin MLU': Math.round(w.adminMLU * 10) / 10,
                  'Creative MLU': Math.round(w.creativeMLU * 10) / 10,
                  'Task Count': w.taskCount,
                }))
              );
              downloadCSV(csv, `nexus-energy-trends-${fileDate()}.csv`);
            },
          },
          {
            label: 'Export Full Report (JSON)',
            description: 'All analytics data as JSON',
            action: () => {
              downloadJSON({
                exported: new Date().toISOString(),
                clientProfiles: clientEnergyProfiles,
                revenueTrends,
                energyTrends,
                monthlyTrends,
                clientHealthScores,
                insights,
                patterns,
                weeklyDebrief,
              }, `nexus-analytics-${fileDate()}.json`);
            },
          },
        ]} />
        <LayoutCustomiser page="analytics" layout={liveLayout} onLayoutChange={setLiveLayout} />
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && <>

      {/* ═══ 1. Weekly Debrief ═══ */}
      {layout.weekly_debrief && weeklyDebrief && (
        <div className="card-elevated rounded-2xl p-5">
          <WeeklyDebrief debrief={weeklyDebrief} history={debriefHistory} collapsible />
        </div>
      )}

      {/* ═══ 2. Hero Section — Portfolio Performance ═══ */}
      {showHero && (
        <div className="card-elevated rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-text-tertiary ">Portfolio Performance</p>
              <InfoTip text="30-day rolling summary of your client work — how much energy you spend vs what you earn." position="bottom" />
            </div>
            <span className="text-xs text-text-tertiary">{activeClientCount} active client{activeClientCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Primary metric */}
          <div className="flex items-baseline gap-2">
            <span className="display-number-large text-text-primary">
              £{avgRevenuePerMLU.toFixed(2)}
            </span>
            <span className="text-sm text-text-tertiary">/MLU avg</span>
            <InfoTip text="Revenue per Mental Load Unit — how much you earn for each unit of cognitive effort. Higher = more efficient." />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <HeroStat label="Monthly Revenue" value={`£${totalMonthlyRevenue.toLocaleString()}`} tip="Total retainer income from all active clients this month." />
            <HeroStat label="MLU Spent" value={totalMLUSpent.toLocaleString()} unit="MLU" tip="Total Mental Load Units used across all client tasks in the last 30 days. Each task has an MLU cost based on its weight and energy type." />
            <HeroStat label="Tasks (12 wks)" value={String(totalTasksCompleted)} tip="Total tasks completed in the last 12 weeks across all clients." />
            <HeroStat
              label="Capacity Used"
              value={`${capacityUsedPct}%`}
              color={capacityUsedPct > 80 ? 'text-red-400' : capacityUsedPct > 60 ? 'text-amber-400' : 'text-text-primary'}
              tip={`How much of your monthly capacity (${capacity} MLU/day × 22 days = ${capacity * 22} MLU) you've used. Green < 60%, amber 60-80%, red > 80%.`}
            />
          </div>

          {/* Capacity bar */}
          <div className="space-y-2">
            <div className="w-full h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, capacityUsedPct)}%`,
                  background: capacityUsedPct > 80 ? '#f87171' : capacityUsedPct > 60 ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══ 3. Insights & Patterns (merged) ═══ */}
      {showInsightsPatterns && combinedInsights.length > 0 && (
        <InsightsPatternsPanel items={combinedInsights} />
      )}

      </>}

      {/* ═══ CLIENTS TAB ═══ */}
      {activeTab === 'clients' && <>

      {/* ═══ Client Energy vs Revenue ═══ */}
      {showClientEnergy && clientEnergyProfiles.length > 0 && (
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-text-tertiary ">Client Energy vs Revenue</p>
                <InfoTip text="Compares how much effort (MLU) each client takes vs what they pay. Helps spot clients that drain energy for low return." position="bottom" />
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                Portfolio avg: <span className="text-text-primary font-mono font-medium">£{avgRevenuePerMLU.toFixed(2)}/MLU</span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              {(['efficiency', 'revenue', 'energy'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setClientSort(s)}
                  className={cn(
                    'text-xs px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer',
                    clientSort === s
                      ? 'bg-surface-tertiary text-text-primary'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary'
                  )}
                >
                  {s === 'efficiency' ? '£/MLU' : s === 'revenue' ? 'Revenue' : 'Energy'}
                </button>
              ))}
            </div>
          </div>

          {/* Client rows */}
          <div className="space-y-2">
            {sortedProfiles.map((profile, rank) => (
              <ClientEnergyRow
                key={profile.clientId}
                profile={profile}
                rank={rank + 1}
                thresholds={efficiencyThresholds}
                capacity={capacity}
              />
            ))}
          </div>

          {/* Portfolio summary */}
          {(() => {
            const totalMLU = clientEnergyProfiles.reduce((s, p) => s + p.totalMLU, 0);
            const totalTasks = clientEnergyProfiles.reduce((s, p) => s + p.taskCount, 0);
            const totalRevenue = clientEnergyProfiles.reduce((s, p) => s + p.monthlyRevenue, 0);
            const totalCapPct = monthlyCapacity > 0 ? Math.round((totalMLU / monthlyCapacity) * 100) : 0;

            return (
              <div className="border-t border-border px-3 sm:px-4 pt-3">
                <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-text-secondary"><strong className="text-text-primary">{totalMLU}</strong> MLU</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-text-secondary"><strong className="text-text-primary">{totalTasks}</strong> tasks</span>
                    <span className="text-text-tertiary">·</span>
                    <span className={cn(
                      'font-medium',
                      totalCapPct > 80 ? 'text-red-400' : totalCapPct > 60 ? 'text-amber-400' : 'text-text-primary'
                    )}>{totalCapPct}%</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-text-secondary">£{totalRevenue.toLocaleString()}/mo</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-text-primary font-medium font-mono">£{totalMLU > 0 ? (totalRevenue / totalMLU).toFixed(2) : '0'}/MLU</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ Client Health Scores ═══ */}
      {layout.client_health_scores && clientHealthScores.length > 0 && (
        <ClientHealthScoresSection scores={clientHealthScores} />
      )}

      {/* ═══ Scope Creep Radar ═══ */}
      {layout.scope_creep_radar && scopeCreepAnalysis && (
        <div className="card-elevated rounded-2xl p-6">
          <h3 className="text-section-heading text-text-primary mb-4">Scope Creep Radar</h3>
          <ScopeCreepRadar analysis={scopeCreepAnalysis} />
        </div>
      )}

      </>}

      {/* ═══ TRENDS TAB ═══ */}
      {activeTab === 'trends' && <>

      {/* ═══ Monthly Trends Comparison ═══ */}
      {layout.monthly_trends && monthlyTrends.length > 0 && (
        <MonthlyTrendsSection trends={monthlyTrends} />
      )}

      {/* ═══ Revenue & Profit Over Time ═══ */}
      {layout.revenue_profit_chart && revenueTrends.length > 0 && (
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">📈</span>
            <h3 className="text-section-heading text-text-primary">Revenue & Profit Over Time</h3>
          </div>
          <p className="text-xs text-text-tertiary">
            Monthly snapshots showing revenue, expenses, and profit from your financial records.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={revenueTrends} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-color)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={({ active, payload, label }: TooltipProps) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="chart-tooltip">
                    <p className="chart-tooltip-label">{label}</p>
                    <div className="space-y-1.5">
                      {payload.map((entry: TooltipPayloadItem, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-6">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                            <span className="text-[11px] text-text-secondary">{entry.name}</span>
                          </div>
                          <span className="chart-tooltip-value">£{entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#gradRevenue)" animationBegin={200} animationDuration={800} animationEasing="ease-out" />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2} fill="url(#gradProfit)" animationBegin={400} animationDuration={800} animationEasing="ease-out" />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} animationBegin={600} animationDuration={800} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ Weekly Energy Investment ═══ */}
      {layout.energy_investment_chart && energyTrends.length > 0 && (
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <h3 className="text-section-heading text-text-primary">Weekly Energy Investment</h3>
          </div>
          <p className="text-xs text-text-tertiary">
            Weekly mental energy split by type. Creative tasks demand more focus, admin is lightweight.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={energyTrends} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-color)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload, label }: TooltipProps) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((s: number, p: TooltipPayloadItem) => s + (p.value || 0), 0);
                return (
                  <div className="chart-tooltip">
                    <p className="chart-tooltip-label">{label}</p>
                    <div className="space-y-1.5">
                      {payload.map((entry: TooltipPayloadItem, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-6">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                            <span className="text-[11px] text-text-secondary">{entry.name}</span>
                          </div>
                          <span className="chart-tooltip-value">{entry.value.toFixed(1)} MLU</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border/30 mt-2 pt-2 flex justify-between">
                      <span className="text-[11px] text-text-secondary">Total</span>
                      <span className="chart-tooltip-value">{total.toFixed(1)} MLU</span>
                    </div>
                  </div>
                );
              }} />
              <Bar dataKey="creativeMLU" name="Creative" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="adminMLU" name="Admin" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} animationBegin={400} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ Task Volume ═══ */}
      {layout.task_volume_chart && (
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">📊</span>
            <h3 className="text-section-heading text-text-primary">Weekly Task Volume</h3>
          </div>
          {weeklyTrendFormatted.length === 0 ? (
            <p className="text-xs text-text-tertiary py-8 text-center">Complete tasks to see trends</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={weeklyTrendFormatted} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-color)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" name="Tasks" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
                <Line type="monotone" dataKey="energy" name="Energy" stroke="var(--accent-blue)" strokeWidth={2} strokeDasharray="4 4" dot={false} animationBegin={400} animationDuration={800} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      </>}

      {/* ═══ DATA TAB ═══ */}
      {activeTab === 'data' && <>

      {/* ═══ Energy by Client ═══ */}
      {layout.energy_by_client && (
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔋</span>
            <h3 className="text-section-heading text-text-primary">Energy by Client</h3>
          </div>
          {projectEnergy.length === 0 ? (
            <p className="text-xs text-text-tertiary py-8 text-center">Complete tasks to see energy breakdown</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={projectEnergy} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)', opacity: 0.3 }} />
                <Bar dataKey="energy" name="Energy" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={20} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ═══ Revenue Radar ═══ */}
      {layout.revenue_radar && clients.length > 0 && (
        <div className="card-elevated rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">📡</span>
            <h3 className="text-section-heading text-text-primary">Revenue Radar</h3>
          </div>
          <RevenueRadar
            clients={clients.map(c => ({
              id: c.id,
              name: c.name,
              retainer_amount: c.retainer_amount ?? 0,
              risk_flag: c.risk_flag ?? false,
              contract_end: c.contract_end ?? null,
              is_active: c.is_active ?? false,
            }))}
          />
        </div>
      )}

      {/* ═══ How MLU Works ═══ */}
      {layout.mlu_explainer && (
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">🧠</span>
            <h3 className="text-section-heading text-text-primary">How Mental Load Units (MLU) Work</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-text-secondary leading-relaxed">
            <div className="space-y-2">
              <p className="text-text-primary font-medium text-xs">What is MLU?</p>
              <p>
                MLU quantifies the cognitive demand of each task based on two factors:
                <strong className="text-text-primary"> weight</strong> (complexity: low, medium, high) and
                <strong className="text-text-primary"> energy type</strong> (admin, creative).
              </p>
              <p>
                A low-weight admin task costs 0.5 MLU. A high-weight creative task costs 5 MLU. Your daily capacity is <strong className="text-text-primary">{capacity} MLU</strong>{dailyCapacity ? '' : ' (default)'}.
              </p>
              <p className="text-xs text-text-tertiary">
                {dailyCapacity ? 'Custom capacity set in Settings.' : 'Customise this in Settings → MLU Capacity.'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-text-primary font-medium text-xs">MLU Scale Reference</p>
              <div className="space-y-2">
                {[
                  ['Low + Admin', '0.5'],
                  ['Low + Creative', '1.5'],
                  ['Medium + Admin', '1.5'],
                  ['Medium + Creative', '2.5'],
                  ['High + Admin', '3'],
                  ['High + Creative', '5'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span>{label}</span>
                    <span className="font-mono text-text-primary">{value} MLU</span>
                  </div>
                ))}
              </div>
              <p className="text-text-tertiary text-xs mt-1">
                Daily capacity: <strong className="text-text-primary">{capacity} MLU</strong> · Warning: {Math.round(capacity * 0.8)}+ · Overload: {capacity}+
              </p>
            </div>
          </div>
        </div>
      )}

      </>}

    </div>
  );
}

// ━━━ Hero Stat ━━━
function HeroStat({ label, value, unit, color, tip }: { label: string; value: string; unit?: string; color?: string; tip?: string }) {
  return (
    <div className="bg-surface-tertiary rounded-2xl px-2.5 sm:px-3 py-2.5 sm:py-3">
      <p className="text-xs sm:text-xs text-text-tertiary  truncate flex items-center gap-1">
        {label}
        {tip && <InfoTip text={tip} position="bottom" />}
      </p>
      <p className={cn('text-sm sm:text-base font-bold font-mono mt-0.5', color || 'text-text-primary')}>
        {value}
        {unit && <span className="text-xs text-text-tertiary font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ━━━ Client Energy Row ━━━
function ClientEnergyRow({
  profile,
  rank,
  thresholds,
  capacity,
}: {
  profile: ClientEnergyProfile;
  rank: number;
  thresholds: { efficient: number; average: number };
  capacity: number;
}) {
  const totalMix = profile.energyMix.creative + profile.energyMix.admin;
  const creativePct = totalMix > 0 ? Math.round((profile.energyMix.creative / totalMix) * 100) : 0;
  const monthlyCapacity = capacity * 22;
  const capacityPct = monthlyCapacity > 0 ? Math.round((profile.totalMLU / monthlyCapacity) * 100) : 0;

  const rating = profile.revenuePerMLU >= thresholds.efficient ? 'Efficient' :
    profile.revenuePerMLU >= thresholds.average ? 'Average' : 'Draining';
  const ratingColor = rating === 'Efficient' ? 'bg-surface-tertiary text-text-primary' :
    rating === 'Average' ? 'bg-surface-tertiary text-text-secondary' : 'bg-surface-tertiary text-text-tertiary';
  const barColor = rating === 'Efficient' ? 'bg-text-primary/40' :
    rating === 'Average' ? 'bg-text-secondary/40' : 'bg-text-tertiary/40';

  return (
    <div className="rounded-2xl border border-border hover:border-border-light px-3 sm:px-4 py-3 transition-colors space-y-2">
      {/* Top row: rank, name, £/MLU, badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs text-text-tertiary font-mono w-4 text-right flex-shrink-0">{rank}</span>
        <span className="text-sm font-medium text-text-primary flex-1 min-w-0 truncate">{profile.name}</span>
        <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 hidden sm:inline group relative', ratingColor)}>
          {rating}
        </span>
        <span className={cn(
          'text-base sm:text-lg font-bold font-mono flex-shrink-0',
          rating === 'Efficient' ? 'text-text-primary' : rating === 'Average' ? 'text-text-secondary' : 'text-text-tertiary'
        )}>
          £{profile.revenuePerMLU > 0 ? profile.revenuePerMLU.toFixed(2) : '—'}
        </span>
        <InfoTip text={`£ earned per MLU of effort. ${rating === 'Efficient' ? 'Above avg — good value.' : rating === 'Average' ? 'Near portfolio average.' : 'Below avg — costs more effort than it earns relative to others.'}`} />
      </div>

      {/* Bottom row: stats + mini bars */}
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
        {profile.riskFlag && profile.riskFlag !== 'none' && (
          <span className="text-xs px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-md">{profile.riskFlag}</span>
        )}
        <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium sm:hidden', ratingColor)}>{rating}</span>
        <span className="text-text-secondary">£{profile.monthlyRevenue.toLocaleString()}/mo</span>
        <span className="text-text-secondary">{profile.totalMLU > 0 ? `${profile.totalMLU} MLU` : '— MLU'}</span>
        <span className="text-text-tertiary hidden sm:inline">{profile.taskCount} tasks</span>

        {/* Energy mix mini-bar — hide on very small screens */}
        {totalMix > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-14 h-1.5 rounded-full overflow-hidden bg-surface-tertiary flex">
              <div className="h-full bg-purple-400" style={{ width: `${creativePct}%` }} />
              <div className="h-full bg-gray-500" style={{ width: `${100 - creativePct}%` }} />
            </div>
            <span className="text-text-tertiary">{creativePct}% creative</span>
          </div>
        )}

        {/* Capacity */}
        <span className={cn(
          'ml-auto font-medium',
          capacityPct > 30 ? 'text-red-400' : capacityPct > 20 ? 'text-amber-400' : 'text-text-tertiary'
        )}>
          {capacityPct}% of capacity
        </span>
      </div>

      {/* Thin capacity bar */}
      <div className="w-full h-1 rounded-full bg-surface-tertiary overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(100, capacityPct)}%`, opacity: 0.6 }}
        />
      </div>
    </div>
  );
}

// ━━━ Insights & Patterns Panel ━━━
function InsightsPatternsPanel({
  items,
}: {
  items: Array<{ type: 'insight' | 'pattern'; severity: string; title: string; detail: string; metric?: string; icon?: string; category?: string }>;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 3);
  const hasMore = items.length > 3;

  return (
    <div className="card-elevated rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">💡</span>
          <p className="text-xs font-medium text-text-tertiary ">
            Insights & Patterns
          </p>
          <span className="text-xs px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-medium">
            {items.length}
          </span>
        </div>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-text-secondary hover:text-text-primary font-medium cursor-pointer transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${items.length}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {visible.map((item, i) => {
          const style = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info;
          return (
            <div
              key={i}
              className={cn(
                'rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 space-y-2 transition-all',
                style.bg
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('text-xs shrink-0', style.text)}>
                    {item.icon || style.icon}
                  </span>
                  <p className="text-xs font-medium text-text-primary">{item.title}</p>
                </div>
                {item.metric && (
                  <span className={cn('text-xs font-bold shrink-0 whitespace-nowrap', style.text)}>
                    {item.metric}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed ml-5">{item.detail}</p>
              {item.category && (
                <span className={cn(
                  'inline-block text-xs px-1.5 py-0.5 rounded-md font-medium ml-5',
                  'bg-surface-tertiary text-text-tertiary'
                )}>
                  {item.category}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ━━━ Monthly Trends Section ━━━
function MonthlyTrendsSection({ trends }: { trends: MonthlyTrend[] }) {
  // Show last 3 months
  const recentTrends = trends.slice(-3);

  return (
    <div className="card-elevated rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">📊</span>
        <h3 className="text-section-heading text-text-primary">Monthly Trends</h3>
      </div>
      <p className="text-xs text-text-tertiary">
        Month-over-month comparison of key metrics. Deltas show change from the previous month.
      </p>

      {recentTrends.length === 0 ? (
        <p className="text-xs text-text-tertiary py-8 text-center">
          Not enough data yet. Trends appear after 2+ months of snapshots.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[360px]">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_repeat(3,_minmax(0,_1fr))] gap-1 mb-2">
              <div />
              {recentTrends.map((t) => (
                <div key={t.month} className="text-center">
                  <p className="text-xs font-medium text-text-tertiary ">{t.label}</p>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            {([
              { key: 'revenue' as const, label: 'Revenue', format: (v: number) => `£${v.toLocaleString()}`, deltaKey: 'revenue' as const },
              { key: 'profit' as const, label: 'Profit', format: (v: number) => `£${v.toLocaleString()}`, deltaKey: 'profit' as const },
              { key: 'taskCount' as const, label: 'Tasks', format: (v: number) => String(v), deltaKey: 'taskCount' as const },
              { key: 'totalMLU' as const, label: 'Total MLU', format: (v: number) => String(v), deltaKey: 'totalMLU' as const },
              { key: 'creativePct' as const, label: 'Creative %', format: (v: number) => `${v}%`, deltaKey: 'creativePct' as const },
            ] as const).map((metric) => (
              <div
                key={metric.key}
                className="grid grid-cols-[1fr_repeat(3,_minmax(0,_1fr))] gap-1 py-2 border-t border-border"
              >
                <p className="text-xs font-medium text-text-secondary  self-center">{metric.label}</p>
                {recentTrends.map((t) => {
                  const value = t[metric.key];
                  const delta = t.deltas[metric.deltaKey];
                  return (
                    <div key={t.month} className="text-center space-y-1.5">
                      <p className="text-xs font-medium text-text-primary font-mono">{metric.format(value)}</p>
                      {delta !== null && (
                        <DeltaBadge value={delta} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Client count row */}
            <div className="grid grid-cols-[1fr_repeat(3,_minmax(0,_1fr))] gap-1 py-2 border-t border-border">
              <p className="text-xs font-medium text-text-secondary  self-center">Clients</p>
              {recentTrends.map((t) => (
                <div key={t.month} className="text-center space-y-1.5">
                  <p className="text-xs font-medium text-text-primary font-mono">{t.clientCount}</p>
                  {t.deltas.clientCount !== null && (
                    <DeltaBadge value={t.deltas.clientCount} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━ Delta Badge ━━━
function DeltaBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-xs text-text-tertiary font-mono">--</span>;
  }
  const isPositive = value > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium font-mono rounded px-1 py-0.5',
      isPositive ? 'text-text-primary bg-surface-tertiary' : 'text-text-secondary bg-surface-tertiary'
    )}>
      {isPositive ? '\u2191' : '\u2193'}{Math.abs(value)}%
    </span>
  );
}

// ━━━ Client Health Scores Section ━━━
function ClientHealthScoresSection({ scores }: { scores: ClientHealthScore[] }) {
  return (
    <div className="card-elevated rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">💊</span>
        <h3 className="text-section-heading text-text-primary">Client Health Scores</h3>
      </div>
      <p className="text-xs text-text-tertiary">
        Health score (0-100) based on task velocity, efficiency, risk status, renewal probability, and energy balance. Sorted by score to highlight clients needing attention.
      </p>

      {scores.length === 0 ? (
        <p className="text-xs text-text-tertiary py-8 text-center">
          No active clients to evaluate.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {scores.map((score) => (
            <ClientHealthCard key={score.clientId} score={score} />
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━ Client Health Card ━━━
function ClientHealthCard({ score }: { score: ClientHealthScore }) {
  const scoreColor = score.healthScore >= 70
    ? 'text-text-primary'
    : score.healthScore >= 40
      ? 'text-amber-400'
      : 'text-red-400';

  const scoreBgColor = score.healthScore >= 70
    ? 'bg-text-primary/40'
    : score.healthScore >= 40
      ? 'bg-amber-400'
      : 'bg-red-400';

  const trendIcon = score.trend === 'improving' ? '\u2191' : score.trend === 'declining' ? '\u2193' : '\u2192';
  const trendColor = score.trend === 'improving'
    ? 'text-text-primary bg-surface-tertiary'
    : score.trend === 'declining'
      ? 'text-text-tertiary bg-surface-tertiary'
      : 'text-text-tertiary bg-surface-tertiary';

  const FACTOR_LABELS: Record<keyof ClientHealthScore['factors'], { label: string; max: number }> = {
    velocity: { label: 'Velocity', max: 30 },
    efficiency: { label: 'Efficiency', max: 25 },
    risk: { label: 'Risk', max: 20 },
    renewal: { label: 'Renewal', max: 15 },
    balance: { label: 'Balance', max: 10 },
  };

  return (
    <div className={cn('rounded-lg bg-surface-tertiary px-3 sm:px-4 py-3 space-y-2.5 transition-colors')}>
      {/* Header: name, score, trend */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-lg font-bold font-mono', scoreColor)}>
            {score.healthScore}
          </span>
          <span className="text-sm font-medium text-text-primary truncate">{score.name}</span>
        </div>
        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-md', trendColor)}>
          {trendIcon} {score.trend}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBgColor)}
          style={{ width: `${score.healthScore}%`, opacity: 0.7 }}
        />
      </div>

      {/* Factor badges */}
      <div className="flex flex-wrap gap-1">
        {(Object.entries(score.factors) as [keyof ClientHealthScore['factors'], number][]).map(([key, value]) => {
          const { label, max } = FACTOR_LABELS[key];
          const pct = max > 0 ? Math.round((value / max) * 100) : 0;
          const badgeColor = pct >= 70
            ? 'bg-surface-tertiary text-text-secondary'
            : pct >= 40
              ? 'bg-surface-tertiary text-text-tertiary'
              : 'bg-surface-tertiary text-text-tertiary';
          return (
            <span
              key={key}
              className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', badgeColor)}
              title={`${label}: ${value}/${max}`}
            >
              {label} {value}/{max}
            </span>
          );
        })}
      </div>
    </div>
  );
}
