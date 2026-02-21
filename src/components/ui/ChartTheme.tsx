'use client';

import { ResponsiveContainer } from 'recharts';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Shared Chart Utilities for Nexus
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Standard tooltip for all Recharts charts */
export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: entry.color }}
              />
              <span className="text-[11px] text-text-secondary">{entry.name}</span>
            </div>
            <span className="chart-tooltip-value">
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** SVG gradient definitions for area charts */
export function ChartGradients({ id = 'default' }: { id?: string }) {
  return (
    <defs>
      <linearGradient id={`areaGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--chart-gradient-start)" />
        <stop offset="100%" stopColor="var(--chart-gradient-end)" />
      </linearGradient>
      <linearGradient id={`accentGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`greenGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.3} />
        <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`blueGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
        <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

/** Standard axis configuration */
export const chartAxisDefaults = {
  xAxis: {
    tick: { fontSize: 11, fill: 'var(--text-tertiary)', fontWeight: 400 },
    axisLine: false,
    tickLine: false,
    tickMargin: 12,
  },
  yAxis: {
    tick: { fontSize: 11, fill: 'var(--text-tertiary)', fontWeight: 400 },
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
  },
  grid: {
    strokeDasharray: '0',
    stroke: 'var(--border-color)',
    strokeOpacity: 0.6,
    vertical: false as const,
  },
};

/** Chart wrapper with consistent sizing */
export function ChartContainer({
  children,
  height = 300,
  className,
}: {
  children: React.ReactElement;
  height?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
