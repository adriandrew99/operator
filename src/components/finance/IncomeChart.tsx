'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
    <div className="card-surface border border-border rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-text-primary">
          <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
          £{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
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
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}K`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ fill: 'var(--accent)', r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="var(--text-tertiary)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
