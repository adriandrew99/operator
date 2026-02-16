'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { DAILY_CAPACITY } from '@/lib/utils/mental-load';
import { RevenueRadar } from '@/components/insights/RevenueRadar';
import { WeeklyDebrief } from '@/components/insights/WeeklyDebrief';
import { LayoutCustomiser } from '@/components/layout/LayoutCustomiser';
import type { Client } from '@/lib/types/database';
import type { ClientEnergyProfile, RevenueInsight, RevenueTrend, EnergyTrend, WeeklyDebrief as WeeklyDebriefData, DetectedPattern } from '@/actions/insights';
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
  dailyCapacity?: number;
  dashboardLayout?: DashboardLayoutPreferences;
}

// ━━━ Shared tooltip ━━━
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-surface border border-border rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-text-primary">
          <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
          {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

// ━━━ Severity styles ━━━
const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  positive: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', icon: '↑', text: 'text-emerald-400' },
  info:     { bg: 'bg-accent/8', border: 'border-accent/20', icon: '→', text: 'text-accent' },
  warning:  { bg: 'bg-amber-500/8', border: 'border-amber-500/20', icon: '⚠', text: 'text-amber-400' },
  danger:   { bg: 'bg-red-500/8', border: 'border-red-500/20', icon: '!', text: 'text-red-400' },
};

export function AnalyticsDashboard({
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
  dailyCapacity,
  dashboardLayout,
}: AnalyticsDashboardProps) {
  const [liveLayout, setLiveLayout] = useState<DashboardLayoutPreferences>(dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT);
  const layout = liveLayout.analytics;
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // ── Computed data ──
  const weeklyTrendFormatted = useMemo(() => {
    return weeklyTrend.map((w) => ({
      ...w,
      label: new Date(w.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }));
  }, [weeklyTrend]);

  const totalMonthlyRevenue = useMemo(() => {
    return clients.filter(c => c.is_active).reduce((s, c) => s + (c.retainer_amount || 0), 0);
  }, [clients]);

  const totalMLUSpent = useMemo(() => {
    return clientEnergyProfiles.reduce((s, p) => s + p.totalMLU, 0);
  }, [clientEnergyProfiles]);

  const avgRevenuePerMLU = useMemo(() => {
    return totalMLUSpent > 0 ? Math.round((totalMonthlyRevenue / totalMLUSpent) * 100) / 100 : 0;
  }, [totalMonthlyRevenue, totalMLUSpent]);

  // Dynamic efficiency thresholds based on portfolio average
  // "Efficient" = above 120% of avg, "Average" = 60-120% of avg, "Draining" = below 60% of avg
  const efficiencyThresholds = useMemo(() => {
    const avg = avgRevenuePerMLU;
    if (avg <= 0) return { efficient: 100, average: 50 }; // fallback for no data
    return {
      efficient: Math.round(avg * 1.2 * 100) / 100,
      average: Math.round(avg * 0.6 * 100) / 100,
    };
  }, [avgRevenuePerMLU]);

  const totalTasksCompleted = useMemo(() => {
    return energyTrends.reduce((s, w) => s + w.taskCount, 0);
  }, [energyTrends]);

  const activeClientCount = useMemo(() => {
    return clients.filter(c => c.is_active).length;
  }, [clients]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="space-y-6">

      {/* ═══ Layout Customiser ═══ */}
      <div className="flex justify-end -mb-3">
        <LayoutCustomiser page="analytics" layout={liveLayout} onLayoutChange={setLiveLayout} />
      </div>

      {/* ═══ Weekly Debrief (collapsible, at top) ═══ */}
      {layout.weekly_debrief && weeklyDebrief && (
        <div className="card-surface border border-accent/20 rounded-2xl p-4 sm:p-6">
          <WeeklyDebrief debrief={weeklyDebrief} collapsible />
        </div>
      )}

      {/* ═══ Insights Box ═══ */}
      {layout.insights && insights.length > 0 && (
        <div className="card-surface border border-border rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">💡</span>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Insights & Recommendations
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.map((insight, i) => {
              const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border px-4 py-3 space-y-1 transition-all',
                    style.bg, style.border
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('text-xs shrink-0', style.text)}>{style.icon}</span>
                      <p className="text-xs font-medium text-text-primary">{insight.title}</p>
                    </div>
                    {insight.metric && (
                      <span className={cn('text-xs font-bold shrink-0', style.text)}>
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed ml-5">{insight.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Pattern Detection ═══ */}
      {layout.patterns && patterns.length > 0 && (
        <div className="card-surface border border-border rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🧬</span>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Detected Patterns
            </p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-medium">
              {patterns.length} found
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patterns.map((pattern, i) => {
              const style = SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.info;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border px-4 py-3 space-y-1.5 transition-all',
                    style.bg, style.border
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{pattern.icon}</span>
                      <p className="text-xs font-medium text-text-primary">{pattern.title}</p>
                    </div>
                    {pattern.metric && (
                      <span className={cn('text-xs font-bold shrink-0 whitespace-nowrap', style.text)}>
                        {pattern.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed ml-7">{pattern.detail}</p>
                  <span className={cn(
                    'inline-block text-[9px] px-1.5 py-0.5 rounded-md font-medium ml-7',
                    pattern.category === 'productivity' ? 'bg-blue-500/10 text-blue-400' :
                    pattern.category === 'energy' ? 'bg-amber-500/10 text-amber-400' :
                    pattern.category === 'correlation' ? 'bg-purple-500/10 text-purple-400' :
                    pattern.category === 'streak' ? 'bg-orange-500/10 text-orange-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  )}>
                    {pattern.category}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Revenue Radar ═══ */}
      {layout.revenue_radar && clients.length > 0 && (
        <div className="card-surface border border-border rounded-2xl card-hover p-6">
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

      {/* ═══ Summary Cards ═══ */}
      {layout.summary_cards && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCardWithExplainer
          label="Monthly Revenue"
          value={`£${totalMonthlyRevenue.toLocaleString()}`}
          hovered={hoveredCard === 'revenue'}
          onHover={(h) => setHoveredCard(h ? 'revenue' : null)}
          explainer="Total monthly retainer income from all active clients. Based on current retainer amounts."
        />
        <SummaryCardWithExplainer
          label="Active Clients"
          value={String(activeClientCount)}
          hovered={hoveredCard === 'clients'}
          onHover={(h) => setHoveredCard(h ? 'clients' : null)}
          explainer="Number of clients currently marked as active. Target 4-6 for healthy diversification."
        />
        <SummaryCardWithExplainer
          label="Revenue / MLU"
          value={`£${avgRevenuePerMLU.toFixed(2)}`}
          accent
          hovered={hoveredCard === 'revmlu'}
          onHover={(h) => setHoveredCard(h ? 'revmlu' : null)}
          explainer="How much you earn per Mental Load Unit across all clients. Higher = more efficient use of your energy. Calculated from completed tasks."
        />
        <SummaryCardWithExplainer
          label="Total MLU Spent"
          value={totalMLUSpent.toLocaleString()}
          unit="MLU"
          hovered={hoveredCard === 'mlu'}
          onHover={(h) => setHoveredCard(h ? 'mlu' : null)}
          explainer="Total Mental Load Units invested across all completed client tasks. MLU measures the cognitive demand of each task based on its weight and energy type."
        />
        <SummaryCardWithExplainer
          label="Tasks (12 wks)"
          value={String(totalTasksCompleted)}
          hovered={hoveredCard === 'tasks12'}
          onHover={(h) => setHoveredCard(h ? 'tasks12' : null)}
          explainer="Total tasks completed over the last 12 weeks. Tracks your output volume and consistency."
        />
      </div>}

      {/* ═══ Revenue & Profit Over Time ═══ */}
      {layout.revenue_profit_chart && revenueTrends.length > 0 && (
        <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-4">
          <div>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Revenue & Profit Over Time
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Monthly snapshots showing revenue, expenses, and profit from your financial records.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="card-surface border border-border rounded-xl px-3 py-2 shadow-lg">
                    <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
                    {payload.map((entry: any, i: number) => (
                      <p key={i} className="text-xs text-text-primary">
                        <span style={{ color: entry.color }}>{entry.name}:</span> £{entry.value.toLocaleString()}
                      </p>
                    ))}
                  </div>
                );
              }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#gradRevenue)" />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2} fill="url(#gradProfit)" />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ Weekly Energy Investment ═══ */}
      {layout.energy_investment_chart && energyTrends.length > 0 && (
        <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-4">
          <div>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Weekly Energy Investment
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              How much mental energy you spend each week, split by type. Creative (purple) demands more focus, admin (gray) is lightweight.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={energyTrends} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
                return (
                  <div className="card-surface border border-border rounded-xl px-3 py-2 shadow-lg">
                    <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
                    {payload.map((entry: any, i: number) => (
                      <p key={i} className="text-xs text-text-primary">
                        <span style={{ color: entry.color }}>{entry.name}:</span> {entry.value.toFixed(1)} MLU
                      </p>
                    ))}
                    <p className="text-xs text-text-primary font-medium border-t border-border/50 mt-1 pt-1">
                      Total: {total.toFixed(1)} MLU
                    </p>
                  </div>
                );
              }} />
              <Bar dataKey="creativeMLU" name="Creative" stackId="a" fill="#a78bfa" radius={[0, 0, 0, 0]} />
              <Bar dataKey="adminMLU" name="Admin" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ Mental Energy Per Client ═══ */}
      {layout.energy_per_client && clientEnergyProfiles.length > 0 && (
        <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-4">
          <div>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Mental Energy Per Client
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              How much cognitive energy each client demands vs how much they pay. Higher £/MLU = better return on your mental investment.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-text-tertiary font-medium">Client</th>
                  <th className="text-right py-2 text-text-tertiary font-medium">Revenue/mo</th>
                  <th className="text-right py-2 text-text-tertiary font-medium">Total MLU</th>
                  <th className="text-right py-2 text-text-tertiary font-medium">Tasks</th>
                  <th className="text-center py-2 text-text-tertiary font-medium">Energy Mix</th>
                  <th className="text-right py-2 text-text-tertiary font-medium">£/MLU</th>
                  <th className="text-right py-2 text-text-tertiary font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {clientEnergyProfiles.map((profile) => {
                  const totalMix = profile.energyMix.creative + profile.energyMix.admin;
                  const creativePct = totalMix > 0 ? (profile.energyMix.creative / totalMix) * 100 : 0;
                  const adminPct = totalMix > 0 ? (profile.energyMix.admin / totalMix) * 100 : 0;

                  return (
                    <tr key={profile.clientId} className="border-b border-border/50 hover:bg-surface-tertiary/30 transition-colors">
                      <td className="py-2.5 text-text-primary font-medium">
                        <div className="flex items-center gap-2">
                          {profile.name}
                          {profile.riskFlag && profile.riskFlag !== 'none' && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-md">
                              {profile.riskFlag}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-text-secondary">
                        £{profile.monthlyRevenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-text-secondary">
                        {profile.totalMLU > 0 ? profile.totalMLU : '—'}
                      </td>
                      <td className="py-2.5 text-right text-text-secondary">
                        {profile.taskCount > 0 ? profile.taskCount : '—'}
                      </td>
                      <td className="py-2.5">
                        {totalMix > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-20 h-2 rounded-full overflow-hidden bg-surface-tertiary flex">
                              <div
                                className="h-full bg-purple-400"
                                style={{ width: `${creativePct}%` }}
                                title={`Creative: ${Math.round(creativePct)}%`}
                              />
                              <div
                                className="h-full bg-gray-500"
                                style={{ width: `${adminPct}%` }}
                                title={`Admin: ${Math.round(adminPct)}%`}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-tertiary text-center block">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono text-text-primary">
                        {profile.revenuePerMLU > 0 ? `£${profile.revenuePerMLU.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        {profile.totalMLU > 0 ? (
                          <span className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-medium',
                            profile.revenuePerMLU >= efficiencyThresholds.efficient ? 'bg-emerald-500/15 text-emerald-400' :
                            profile.revenuePerMLU >= efficiencyThresholds.average ? 'bg-amber-500/15 text-amber-400' :
                            'bg-red-500/15 text-red-400'
                          )}>
                            {profile.revenuePerMLU >= efficiencyThresholds.efficient ? 'Efficient' : profile.revenuePerMLU >= efficiencyThresholds.average ? 'Average' : 'Draining'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">No data</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-text-tertiary pt-1">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
              <span>Creative</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-gray-500" />
              <span>Admin</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Client Energy & Time Breakdown ═══ */}
      {layout.client_energy_breakdown && clientEnergyProfiles.length > 0 && (
        <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-5">
          <div>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Client Energy & Time Breakdown
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Weekly and monthly energy investment per client, with estimated hours and capacity share. Based on last 30 days of completed tasks.
            </p>
          </div>

          {/* Client cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clientEnergyProfiles.map((profile) => {
              // Estimate weekly values (30-day data ÷ ~4.3 weeks)
              const weeklyMLU = Math.round((profile.totalMLU / 4.3) * 10) / 10;
              const monthlyMLU = profile.totalMLU;
              // Capacity share: what % of your monthly capacity does this client consume?
              // Monthly capacity = daily × ~22 work days
              const monthlyCapacity = capacity * 22;
              const capacityPct = monthlyCapacity > 0 ? Math.round((monthlyMLU / monthlyCapacity) * 100) : 0;
              // Rough time estimate: admin tasks ~15min avg, creative ~30min avg
              const adminTasks = profile.energyMix.admin;
              const creativeTasks = profile.energyMix.creative;
              const estMonthlyMinutes = (adminTasks * 15) + (creativeTasks * 35);
              const estWeeklyMinutes = Math.round(estMonthlyMinutes / 4.3);
              const weeklyTasks = Math.round((profile.taskCount / 4.3) * 10) / 10;
              // Weight breakdown
              const totalWeight = profile.weightMix.high + profile.weightMix.medium + profile.weightMix.low;
              const highPct = totalWeight > 0 ? Math.round((profile.weightMix.high / totalWeight) * 100) : 0;
              const medPct = totalWeight > 0 ? Math.round((profile.weightMix.medium / totalWeight) * 100) : 0;
              const lowPct = totalWeight > 0 ? Math.round((profile.weightMix.low / totalWeight) * 100) : 0;

              return (
                <div key={profile.clientId} className="rounded-xl border border-border p-4 space-y-3 hover:border-border-light transition-colors">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{profile.name}</p>
                      {profile.riskFlag && profile.riskFlag !== 'none' && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-md">{profile.riskFlag}</span>
                      )}
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-medium',
                      profile.revenuePerMLU >= efficiencyThresholds.efficient ? 'bg-emerald-500/15 text-emerald-400' :
                      profile.revenuePerMLU >= efficiencyThresholds.average ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    )}>
                      £{profile.revenuePerMLU.toFixed(2)}/MLU
                    </span>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] text-text-tertiary">Weekly</p>
                      <p className="text-sm font-bold text-text-primary">{weeklyMLU} <span className="text-[10px] text-text-tertiary font-normal">MLU</span></p>
                      <p className="text-[10px] text-text-tertiary">~{weeklyTasks} tasks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-text-tertiary">Monthly</p>
                      <p className="text-sm font-bold text-text-primary">{monthlyMLU} <span className="text-[10px] text-text-tertiary font-normal">MLU</span></p>
                      <p className="text-[10px] text-text-tertiary">{profile.taskCount} tasks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-text-tertiary">Est. Time</p>
                      <p className="text-sm font-bold text-text-primary">
                        {estWeeklyMinutes >= 60 ? `${(estWeeklyMinutes / 60).toFixed(1)}h` : `${estWeeklyMinutes}m`}
                        <span className="text-[10px] text-text-tertiary font-normal">/wk</span>
                      </p>
                      <p className="text-[10px] text-text-tertiary">
                        {estMonthlyMinutes >= 60 ? `~${(estMonthlyMinutes / 60).toFixed(1)}h` : `~${estMonthlyMinutes}m`}/mo
                      </p>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-text-tertiary">Capacity share</p>
                      <p className={cn(
                        'text-[10px] font-medium',
                        capacityPct > 30 ? 'text-red-400' : capacityPct > 20 ? 'text-amber-400' : 'text-text-secondary'
                      )}>{capacityPct}%</p>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          capacityPct > 30 ? 'bg-red-400' : capacityPct > 20 ? 'bg-amber-400' : 'bg-accent'
                        )}
                        style={{ width: `${Math.min(100, capacityPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Weight breakdown */}
                  <div className="flex items-center gap-2 text-[10px]">
                    {profile.weightMix.high > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400">{highPct}% high</span>
                    )}
                    {profile.weightMix.medium > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400/70">{medPct}% med</span>
                    )}
                    {profile.weightMix.low > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">{lowPct}% low</span>
                    )}
                    <span className="text-text-tertiary ml-auto">
                      £{profile.monthlyRevenue.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals summary row */}
          {(() => {
            const activeProfiles = clientEnergyProfiles;
            const totalMLU = activeProfiles.reduce((s, p) => s + p.totalMLU, 0);
            const totalTasks = activeProfiles.reduce((s, p) => s + p.taskCount, 0);
            const totalRevenue = activeProfiles.reduce((s, p) => s + p.monthlyRevenue, 0);
            const totalAdminTasks = activeProfiles.reduce((s, p) => s + p.energyMix.admin, 0);
            const totalCreativeTasks = activeProfiles.reduce((s, p) => s + p.energyMix.creative, 0);
            const totalEstMinutes = (totalAdminTasks * 15) + (totalCreativeTasks * 35);
            const monthlyCapacity = capacity * 22;
            const totalCapPct = monthlyCapacity > 0 ? Math.round((totalMLU / monthlyCapacity) * 100) : 0;

            return (
              <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-text-secondary"><strong className="text-text-primary">{totalMLU}</strong> total MLU/mo</span>
                    <span className="text-text-tertiary">|</span>
                    <span className="text-text-secondary"><strong className="text-text-primary">{totalTasks}</strong> tasks</span>
                    <span className="text-text-tertiary">|</span>
                    <span className="text-text-secondary">~<strong className="text-text-primary">{totalEstMinutes >= 60 ? `${(totalEstMinutes / 60).toFixed(1)}h` : `${totalEstMinutes}m`}</strong>/mo</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={cn(
                      'font-medium',
                      totalCapPct > 80 ? 'text-red-400' : totalCapPct > 60 ? 'text-amber-400' : 'text-emerald-400'
                    )}>
                      {totalCapPct}% of monthly capacity
                    </span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-text-secondary">£{totalRevenue.toLocaleString()}/mo</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-accent font-medium">£{totalMLU > 0 ? (totalRevenue / totalMLU).toFixed(2) : '0'}/MLU avg</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ Charts Row — Existing ═══ */}
      {(layout.energy_by_client || layout.task_volume_chart) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Energy by Client */}
        {layout.energy_by_client && <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-4">
          <div>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Energy by Client
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Total MLU spent per client across all completed tasks.
            </p>
          </div>
          {projectEnergy.length === 0 ? (
            <p className="text-xs text-text-tertiary py-8 text-center">Complete tasks to see energy breakdown</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={projectEnergy} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)', opacity: 0.3 }} />
                <Bar dataKey="energy" name="Energy" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>}

        {/* Weekly Task Volume */}
        {layout.task_volume_chart && <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-4">
          <div>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Weekly Task Volume
            </p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Tasks completed each week with corresponding energy spend. Tracks output consistency.
            </p>
          </div>
          {weeklyTrendFormatted.length === 0 ? (
            <p className="text-xs text-text-tertiary py-8 text-center">Complete tasks to see trends</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weeklyTrendFormatted} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" name="Tasks" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="energy" name="Energy" stroke="var(--accent-blue)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>}
      </div>
      )}

      {/* ═══ Client Efficiency Comparison ═══ */}
      {layout.efficiency_comparison && clientEfficiency.length > 0 && (() => {
        const sorted = [...clientEfficiency].sort((a, b) => b.efficiency - a.efficiency);
        const maxEfficiency = sorted[0]?.efficiency || 1;
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        const totalEnergy = sorted.reduce((s, c) => s + c.energy, 0);

        // Auto-generate 1-2 plain-English comparisons
        const comparisons: string[] = [];
        if (sorted.length >= 2 && best && worst && best.name !== worst.name && worst.efficiency > 0) {
          const ratio = Math.round((best.efficiency / worst.efficiency) * 10) / 10;
          comparisons.push(
            `${best.name} earns £${best.efficiency}/MLU. ${worst.name} earns £${worst.efficiency}/MLU. ${best.name} is ${ratio}x more efficient per mental unit.`
          );
        }
        if (sorted.length >= 3) {
          const mid = sorted[Math.floor(sorted.length / 2)];
          if (mid && mid.name !== best?.name && mid.name !== worst?.name) {
            comparisons.push(
              `${mid.name} sits in the middle at £${mid.efficiency}/MLU — ${mid.efficiency > avgRevenuePerMLU ? 'above' : 'below'} your portfolio average of £${avgRevenuePerMLU.toFixed(0)}/MLU.`
            );
          }
        }

        // Awards
        const awards: { label: string; client: string; detail: string }[] = [];
        if (best) awards.push({ label: 'Highest Leverage', client: best.name, detail: `£${best.efficiency}/MLU` });
        if (worst && worst.name !== best?.name) awards.push({ label: 'Most Draining', client: worst.name, detail: `£${worst.efficiency}/MLU` });
        // Heaviest energy consumer
        const heaviest = [...sorted].sort((a, b) => b.energy - a.energy)[0];
        if (heaviest && heaviest.name !== best?.name && heaviest.name !== worst?.name) {
          awards.push({ label: 'Energy Sink', client: heaviest.name, detail: `${heaviest.energy} MLU (${totalEnergy > 0 ? Math.round((heaviest.energy / totalEnergy) * 100) : 0}%)` });
        }

        return (
          <div className="card-surface border border-border rounded-2xl card-hover p-6 space-y-5">
            <div>
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
                Client Efficiency Comparison
              </p>
              <p className="text-[10px] text-text-tertiary mt-1">
                Ranked by £ earned per MLU. Avg: <span className="text-accent font-mono">£{avgRevenuePerMLU.toFixed(0)}/MLU</span>. Bars show relative efficiency across your portfolio.
              </p>
            </div>

            {/* Awards row */}
            {awards.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {awards.map((award) => (
                  <div key={award.label} className="rounded-xl bg-surface-tertiary/40 border border-border/50 px-3 py-2.5 text-center">
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider">{award.label}</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{award.client}</p>
                    <p className="text-[10px] text-accent font-mono">{award.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Client efficiency bars */}
            <div className="space-y-3">
              {sorted.map((client, i) => {
                const barPct = maxEfficiency > 0 ? Math.round((client.efficiency / maxEfficiency) * 100) : 0;
                const energyPct = totalEnergy > 0 ? Math.round((client.energy / totalEnergy) * 100) : 0;
                const ratingColor = client.efficiency >= efficiencyThresholds.efficient ? 'text-emerald-400' :
                  client.efficiency >= efficiencyThresholds.average ? 'text-amber-400' : 'text-red-400';
                const barColor = client.efficiency >= efficiencyThresholds.efficient ? 'bg-emerald-400' :
                  client.efficiency >= efficiencyThresholds.average ? 'bg-amber-400' : 'bg-red-400';
                const rating = client.efficiency >= efficiencyThresholds.efficient ? 'Efficient' :
                  client.efficiency >= efficiencyThresholds.average ? 'Average' : 'Draining';

                return (
                  <div key={client.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-tertiary w-4 text-right font-mono">{i + 1}</span>
                        <span className="text-xs text-text-primary font-medium">{client.name}</span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-md font-medium', ratingColor,
                          client.efficiency >= efficiencyThresholds.efficient ? 'bg-emerald-500/10' :
                          client.efficiency >= efficiencyThresholds.average ? 'bg-amber-500/10' : 'bg-red-500/10'
                        )}>
                          {rating}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-text-tertiary">£{client.revenue.toLocaleString()}/mo</span>
                        <span className="text-text-tertiary">{client.energy} MLU</span>
                        <span className="text-text-tertiary">({energyPct}%)</span>
                        <span className={cn('font-mono font-medium', ratingColor)}>£{client.efficiency}/MLU</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', barColor)}
                          style={{ width: `${barPct}%`, opacity: 0.7 + (barPct / 300) }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Average line reference */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/15">
              <div className="w-3 h-0.5 bg-accent rounded-full" />
              <span className="text-[10px] text-accent">Portfolio average: <span className="font-mono font-medium">£{avgRevenuePerMLU.toFixed(2)}/MLU</span></span>
            </div>

            {/* Auto-generated comparisons */}
            {comparisons.length > 0 && (
              <div className="space-y-2 pt-1">
                {comparisons.map((comparison, i) => (
                  <p key={i} className="text-[11px] text-text-secondary leading-relaxed pl-3 border-l-2 border-border">
                    {comparison}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ How MLU Works — Explainer ═══ */}
      {layout.mlu_explainer && <div className="card-surface border border-border rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
            How Mental Load Units (MLU) Work
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-text-secondary leading-relaxed">
          <div className="space-y-2">
            <p className="text-text-primary font-medium text-xs">What is MLU?</p>
            <p>
              MLU quantifies the cognitive demand of each task based on two factors:
              <strong className="text-text-primary"> weight</strong> (complexity: low, medium, high) and
              <strong className="text-text-primary"> energy type</strong> (admin, creative).
            </p>
            <p>
              A low-weight admin task costs 0.5 MLU. A high-weight creative task costs 5 MLU. Your daily capacity is <strong className="text-accent">{capacity} MLU</strong>{dailyCapacity ? '' : ' (default)'}.
            </p>
            <p className="text-[10px] text-text-tertiary">
              {dailyCapacity ? 'Custom capacity set in Settings.' : 'Customise this in Settings → MLU Capacity.'}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-text-primary font-medium text-xs">MLU Scale Reference</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>Low + Admin</span>
                <span className="font-mono text-text-primary">0.5 MLU</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Low + Creative</span>
                <span className="font-mono text-text-primary">1.5 MLU</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Medium + Admin</span>
                <span className="font-mono text-text-primary">1.5 MLU</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Medium + Creative</span>
                <span className="font-mono text-text-primary">2.5 MLU</span>
              </div>
              <div className="flex items-center justify-between">
                <span>High + Admin</span>
                <span className="font-mono text-text-primary">3 MLU</span>
              </div>
              <div className="flex items-center justify-between">
                <span>High + Creative</span>
                <span className="font-mono text-text-primary">5 MLU</span>
              </div>
            </div>
            <p className="text-text-tertiary text-[10px] mt-1">
              Daily capacity: <strong className="text-text-primary">{capacity} MLU</strong> · Warning: {Math.round(capacity * 0.8)}+ · Overload: {capacity}+
            </p>
          </div>
        </div>
      </div>}

    </div>
  );
}

// ━━━ Summary Card with Hover Explainer ━━━
function SummaryCardWithExplainer({
  label,
  value,
  unit,
  accent,
  hovered,
  onHover,
  explainer,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  hovered: boolean;
  onHover: (h: boolean) => void;
  explainer: string;
}) {
  return (
    <div
      className="card-surface border border-border rounded-2xl card-hover p-5 space-y-1 relative cursor-default"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">{label}</p>
      <p className={cn('text-xl font-bold', accent ? 'text-accent' : 'text-text-primary')}>
        {value}
        {unit && <span className="text-sm text-text-tertiary ml-1">{unit}</span>}
      </p>

      {/* Hover explainer */}
      {hovered && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 p-2.5 rounded-xl card-surface border border-border shadow-lg">
          <p className="text-[10px] text-text-secondary leading-relaxed">{explainer}</p>
        </div>
      )}
    </div>
  );
}
