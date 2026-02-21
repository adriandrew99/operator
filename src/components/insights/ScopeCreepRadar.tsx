'use client';

import { cn } from '@/lib/utils/cn';
import type { ScopeCreepAnalysis, ScopeCreepClient } from '@/actions/insights';

interface ScopeCreepRadarProps {
  analysis: ScopeCreepAnalysis;
}

const SEVERITY_CONFIG = {
  stable: { label: 'Stable', color: 'text-text-primary', bg: 'bg-text-primary', dot: 'bg-text-secondary', border: 'border-border' },
  drifting: { label: 'Drifting', color: 'text-text-secondary', bg: 'bg-text-secondary', dot: 'bg-text-tertiary', border: 'border-border' },
  creeping: { label: 'Creeping', color: 'text-text-tertiary', bg: 'bg-text-tertiary', dot: 'bg-text-tertiary', border: 'border-border' },
};

const HEALTH_CONFIG = {
  healthy: { label: 'Healthy', color: 'text-text-primary', bg: 'bg-surface-tertiary' },
  watch: { label: 'Watch', color: 'text-text-secondary', bg: 'bg-surface-tertiary' },
  action_needed: { label: 'Action Needed', color: 'text-text-tertiary', bg: 'bg-surface-tertiary' },
};

function Sparkline({ values, color, width = 64, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = values.map((v, i) => ({
    x: padding + (chartW / Math.max(1, values.length - 1)) * i,
    y: padding + chartH - ((v - min) / range) * chartH,
  }));

  const path = points.map((p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest point dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2"
        fill={color}
      />
    </svg>
  );
}

function TrendBadge({ value, label, inverse = false }: { value: number; label: string; inverse?: boolean }) {
  if (value === 0) return null;
  // For £/MLU, rising is good (inverse=true means positive is good)
  const isGood = inverse ? value > 0 : value < 0;
  const isBad = inverse ? value < 0 : value > 0;
  const arrow = value > 0 ? '\u2191' : '\u2193';

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium font-mono rounded px-1 py-0.5',
      isBad ? 'text-text-tertiary bg-surface-tertiary' :
      isGood ? 'text-text-primary bg-surface-tertiary' :
      'text-text-tertiary bg-surface-tertiary'
    )}>
      {arrow} {Math.abs(value)}% {label}
    </span>
  );
}

function ClientScopeCard({ client }: { client: ScopeCreepClient }) {
  const config = SEVERITY_CONFIG[client.severity];

  return (
    <div className={cn('border-t pt-3 space-y-2.5 transition-colors', config.border)}>
      {/* Header: name + severity badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', config.dot)} />
          <span className="text-sm font-medium text-text-primary truncate">{client.clientName}</span>
        </div>
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0',
          client.severity === 'stable' ? 'bg-surface-tertiary text-text-primary' :
          client.severity === 'drifting' ? 'bg-surface-tertiary text-text-secondary' :
          'bg-surface-tertiary text-text-tertiary'
        )}>
          {config.label}
        </span>
      </div>

      {/* Sparklines + current stats */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* MLU sparkline */}
        <div className="flex items-center gap-1.5">
          <Sparkline
            values={client.weeklyMLU}
            color={client.mluTrendPct > 15 ? 'var(--text-tertiary)' : client.mluTrendPct > 0 ? 'var(--text-secondary)' : 'var(--text-primary)'}
          />
          <div className="text-xs">
            <span className="text-text-secondary font-mono">{client.currentMLU}</span>
            <span className="text-text-tertiary"> MLU/wk</span>
          </div>
        </div>

        {/* separator */}
        <span className="text-text-tertiary text-xs hidden sm:inline">&middot;</span>

        {/* £/MLU sparkline */}
        <div className="flex items-center gap-1.5">
          <Sparkline
            values={client.weeklyRevenuePerMLU}
            color={client.revenuePerMLUTrendPct < -15 ? 'var(--text-tertiary)' : client.revenuePerMLUTrendPct < 0 ? 'var(--text-secondary)' : 'var(--text-primary)'}
          />
          <div className="text-xs">
            <span className="text-text-secondary font-mono">&pound;{client.currentRevenuePerMLU.toFixed(0)}</span>
            <span className="text-text-tertiary">/MLU</span>
          </div>
        </div>
      </div>

      {/* Trend indicators */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <TrendBadge value={client.mluTrendPct} label="MLU" />
        <TrendBadge value={client.revenuePerMLUTrendPct} label="&pound;/MLU" inverse />
      </div>

      {/* Signals */}
      {client.signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {client.signals.map((signal, i) => (
            <span
              key={i}
              className="text-xs px-1.5 py-0.5 rounded-md bg-surface-tertiary text-text-secondary"
            >
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* Recommendation */}
      {client.recommendation && (
        <p className="text-xs text-text-tertiary leading-relaxed border-t border-border pt-2">
          {client.recommendation}
        </p>
      )}
    </div>
  );
}

export function ScopeCreepRadar({ analysis }: ScopeCreepRadarProps) {
  const healthConfig = HEALTH_CONFIG[analysis.overallHealth];

  if (analysis.clients.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-tertiary">
          Not enough weekly debrief data yet. Scope trends appear after 3+ weeks of tracked work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          {analysis.summary}
        </p>
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded-md',
          healthConfig.bg, healthConfig.color
        )}>
          {healthConfig.label}
        </span>
      </div>

      {/* Client cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {analysis.clients.map(client => (
          <ClientScopeCard key={client.clientId} client={client} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            <span className="text-xs text-text-tertiary">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
