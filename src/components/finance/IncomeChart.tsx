'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils/cn';
import type { FinancialSnapshot } from '@/lib/types/database';

interface ProjectedMonth {
  month: string;
  confirmed: number;
  likely: number;
  possible: number;
}

interface IncomeChartProps {
  snapshots: FinancialSnapshot[];
  currentMonthRevenue?: number;
  currentMonthExpenses?: number;
  viewedMonth?: string;
  projectedIncome?: ProjectedMonth[];
}

const RANGE_OPTIONS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
] as const;

const PROJECTION_MONTHS = 2;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => {
          if (entry.value == null) return null;
          return (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-[11px] text-text-secondary">{entry.name}</span>
              </div>
              <span className="chart-tooltip-value">£{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function IncomeChart({ snapshots, currentMonthRevenue, currentMonthExpenses, viewedMonth, projectedIncome }: IncomeChartProps) {
  const [rangeMonths, setRangeMonths] = useState(6);
  const [showProjections, setShowProjections] = useState(true);
  const now = new Date();
  const viewedMonthStr = viewedMonth ? viewedMonth.slice(0, 7) : now.toISOString().split('T')[0].slice(0, 7);

  const data = useMemo(() => {
    // Build all historical data points, replacing the viewed month with live data
    const allHistorical = snapshots
      .filter(s => {
        const snapMonth = String(s.month).slice(0, 7);
        // Exclude the viewed month from snapshots — we'll add live data for it
        return snapMonth !== viewedMonthStr;
      })
      .map((s) => {
        const monthStr = String(s.month);
        const dateStr = monthStr.length <= 7 ? monthStr + '-01' : monthStr;
        const parsed = new Date(dateStr + 'T00:00:00');
        const label = !isNaN(parsed.getTime())
          ? parsed.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          : monthStr;

        return {
          month: label,
          sortKey: dateStr,
          revenue: Number(s.total_revenue) || 0,
          expenses: Number(s.total_expenses) || 0,
          net: (Number(s.total_revenue) || 0) - (Number(s.total_expenses) || 0),
          isProjected: false,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Add viewed month from live client-based data
    if (currentMonthRevenue !== undefined) {
      const viewedDate = new Date(viewedMonthStr + '-01T12:00:00');
      const viewedLabel = viewedDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      allHistorical.push({
        month: viewedLabel,
        sortKey: viewedMonthStr + '-01',
        revenue: currentMonthRevenue,
        expenses: currentMonthExpenses || 0,
        net: currentMonthRevenue - (currentMonthExpenses || 0),
        isProjected: false,
      });
      allHistorical.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }

    // Trim historical data to the selected range
    const trimmed = allHistorical.slice(-rangeMonths);

    // Build combined dataset
    type ChartDataPoint = {
      month: string;
      revenue?: number | null;
      expenses?: number | null;
      net?: number | null;
      projectedConfirmed?: number | null;
      projectedLikely?: number | null;
      projectedPossible?: number | null;
      isProjected: boolean;
    };

    const combined: ChartDataPoint[] = trimmed.map(d => ({
      month: d.month,
      revenue: d.revenue,
      expenses: d.expenses,
      net: d.net,
      projectedConfirmed: null,
      projectedLikely: null,
      projectedPossible: null,
      isProjected: false,
    }));

    // Add projection bridge + projected months
    const projSlice = showProjections ? (projectedIncome?.slice(0, PROJECTION_MONTHS) ?? []) : [];
    if (projSlice.length > 0 && combined.length > 0) {
      const lastHistorical = combined[combined.length - 1];
      lastHistorical.projectedConfirmed = lastHistorical.revenue ?? 0;
      lastHistorical.projectedLikely = lastHistorical.revenue ?? 0;
      lastHistorical.projectedPossible = lastHistorical.revenue ?? 0;

      for (const pm of projSlice) {
        combined.push({
          month: pm.month,
          revenue: null,
          expenses: null,
          net: null,
          projectedConfirmed: pm.confirmed,
          projectedLikely: pm.confirmed + pm.likely,
          projectedPossible: pm.confirmed + pm.likely + pm.possible,
          isProjected: true,
        });
      }
    }

    return combined;
  }, [snapshots, currentMonthRevenue, currentMonthExpenses, viewedMonthStr, rangeMonths, projectedIncome, showProjections]);

  const hasProjections = projectedIncome && projectedIncome.length > 0;

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-tertiary">Add financial snapshots to see income trends</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-end gap-1 mb-3">
        {projectedIncome && projectedIncome.length > 0 && (
          <button
            onClick={() => setShowProjections(!showProjections)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer mr-1',
              showProjections
                ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary'
            )}
          >
            Projected
          </button>
        )}
        <div className="w-px h-4 bg-border opacity-50" />
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.months}
            onClick={() => setRangeMonths(opt.months)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
              rangeMonths === opt.months
                ? 'bg-surface-tertiary text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="incomeExpensesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--text-tertiary)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--text-tertiary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="projectedConfirmedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.20} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="projectedLikelyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="projectedPossibleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--text-tertiary)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="var(--text-tertiary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border-color)" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `£${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Historical revenue */}
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#incomeRevenueGrad)"
            dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={false}
          />

          {/* Historical expenses */}
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="var(--text-tertiary)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="url(#incomeExpensesGrad)"
            dot={false}
            connectNulls={false}
          />

          {/* Projected: Possible (outer band — widest) */}
          {hasProjections && (
            <Area
              type="monotone"
              dataKey="projectedPossible"
              name="Possible"
              stroke="var(--text-tertiary)"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.4}
              fill="url(#projectedPossibleGrad)"
              dot={false}
              connectNulls={false}
            />
          )}

          {/* Projected: Likely (middle band) */}
          {hasProjections && (
            <Area
              type="monotone"
              dataKey="projectedLikely"
              name="Likely"
              stroke="#facc15"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeOpacity={0.6}
              fill="url(#projectedLikelyGrad)"
              dot={false}
              connectNulls={false}
            />
          )}

          {/* Projected: Confirmed (inner — solid-ish) */}
          {hasProjections && (
            <Area
              type="monotone"
              dataKey="projectedConfirmed"
              name="Confirmed"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="url(#projectedConfirmedGrad)"
              dot={{ fill: 'var(--accent)', r: 2.5, strokeWidth: 0, fillOpacity: 0.6 }}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full bg-[var(--accent)]" />
          <span className="text-xs text-text-tertiary">Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 border-t border-dashed border-text-tertiary" />
          <span className="text-xs text-text-tertiary">Expenses</span>
        </div>
        {hasProjections && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-3 border-t-2 border-dashed border-[var(--accent)] opacity-70" />
              <span className="text-xs text-text-tertiary">Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 border-t-2 border-dashed border-amber-400 opacity-60" />
              <span className="text-xs text-text-tertiary">Likely</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 border-t border-dashed border-text-tertiary opacity-40" />
              <span className="text-xs text-text-tertiary">Possible</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
