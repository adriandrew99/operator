'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Client } from '@/lib/types/database';

interface EarningsByClientProps {
  clients: Client[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-surface border border-border rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-text-primary mb-0.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[10px] text-text-secondary">
          £{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}/mo
        </p>
      ))}
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
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `£${v.toLocaleString()}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)', opacity: 0.3 }} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
