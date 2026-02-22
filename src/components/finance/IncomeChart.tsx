'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { FinancialSnapshot } from '@/lib/types/database';

interface IncomeChartProps {
  snapshots: FinancialSnapshot[];
  currentMonthRevenue?: number;
  currentMonthExpenses?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
              <span className="text-[11px] text-text-secondary">{entry.name}</span>
            </div>
            <span className="chart-tooltip-value">£{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function IncomeChart({ snapshots, currentMonthRevenue, currentMonthExpenses }: IncomeChartProps) {
  const now = new Date();
  const currentMonthStr = now.toISOString().split('T')[0].slice(0, 7);

  const data = snapshots
    .filter(s => {
      // Exclude current month snapshot — we always use live data for current month
      const snapMonth = String(s.month).slice(0, 7);
      return snapMonth !== currentMonthStr;
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
        revenue: Number(s.total_revenue) || 0,
        expenses: Number(s.total_expenses) || 0,
        net: (Number(s.total_revenue) || 0) - (Number(s.total_expenses) || 0),
      };
    });

  // Always add current month from live client data (active retainers)
  if (currentMonthRevenue !== undefined) {
    const currentLabel = now.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    data.push({
      month: currentLabel,
      revenue: currentMonthRevenue,
      expenses: currentMonthExpenses || 0,
      net: currentMonthRevenue - (currentMonthExpenses || 0),
    });
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-tertiary">Add financial snapshots to see income trends</p>
      </div>
    );
  }

  return (
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
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--accent)"
          strokeWidth={2}
          fill="url(#incomeRevenueGrad)"
          dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="var(--text-tertiary)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="url(#incomeExpensesGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
