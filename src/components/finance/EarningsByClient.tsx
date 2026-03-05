'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Client } from '@/lib/types/database';

interface EarningsByClientProps {
  clients: Client[];
}

interface TooltipPayloadItem { name?: string; value?: number; color?: string }
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: TooltipPayloadItem, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent" />
              <span className="text-[11px] text-text-secondary">Revenue</span>
            </div>
            <span className="chart-tooltip-value">£{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}/mo</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function EarningsByClient({ clients }: EarningsByClientProps) {
  const data = clients
    .filter((c) => c.is_active && c.retainer_amount)
    .map((c) => ({
      name: c.name,
      revenue: c.retainer_amount || 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-tertiary">Add clients with retainers to see earnings</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="clientBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `£${v.toLocaleString()}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)', opacity: 0.3 }} />
        <Bar dataKey="revenue" name="Revenue" fill="url(#clientBarGrad)" radius={[0, 6, 6, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
