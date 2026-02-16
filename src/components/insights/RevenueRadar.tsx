'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

interface RevenueRadarProps {
  clients: {
    id: string;
    name: string;
    retainer_amount: number | null;
    risk_flag: boolean;
    contract_end: string | null;
    is_active: boolean;
  }[];
}

interface RadarMetric {
  label: string;
  score: number;
  detail: string;
}

interface RiskAlert {
  type: 'concentration' | 'expiry' | 'risk';
  severity: 'warning' | 'danger';
  message: string;
}

export function RevenueRadar({ clients }: RevenueRadarProps) {
  const analysis = useMemo(() => {
    const activeClients = clients.filter((c) => c.is_active);
    const alerts: RiskAlert[] = [];

    // Calculate total MRR from active clients with retainers
    const totalMRR = activeClients.reduce(
      (sum, c) => sum + (c.retainer_amount ?? 0),
      0
    );

    // Diversification score (0-100): penalize if any single client > 40% of revenue
    let diversificationScore = 100;
    if (activeClients.length === 0) {
      diversificationScore = 0;
    } else if (activeClients.length === 1) {
      diversificationScore = 20;
    } else {
      activeClients.forEach((client) => {
        const clientRevenue = client.retainer_amount ?? 0;
        const share = totalMRR > 0 ? clientRevenue / totalMRR : 0;
        if (share > 0.4) {
          diversificationScore = Math.min(
            diversificationScore,
            Math.round(100 * (1 - (share - 0.4) / 0.6))
          );
          alerts.push({
            type: 'concentration',
            severity: share > 0.6 ? 'danger' : 'warning',
            message: `${client.name} is ${Math.round(share * 100)}% of revenue. High concentration risk.`,
          });
        }
      });
      // Bonus for having more clients
      const clientBonus = Math.min(20, (activeClients.length - 1) * 5);
      diversificationScore = Math.min(100, Math.max(0, diversificationScore + clientBonus - 20));
    }

    // Recurring score (0-100): based on having recurring revenue
    const clientsWithRetainers = activeClients.filter(
      (c) => c.retainer_amount && c.retainer_amount > 0
    ).length;
    const recurringScore =
      activeClients.length > 0
        ? Math.round((clientsWithRetainers / activeClients.length) * 100)
        : 0;

    // Risk score (0-100): inverted, higher = safer
    let riskDeductions = 0;
    const flaggedClients = activeClients.filter((c) => c.risk_flag);
    riskDeductions += flaggedClients.length * 20;
    flaggedClients.forEach((c) => {
      alerts.push({
        type: 'risk',
        severity: 'danger',
        message: `${c.name} is flagged as at-risk.`,
      });
    });

    // Contract expiry warnings (within 60 days)
    const now = new Date();
    activeClients.forEach((client) => {
      if (client.contract_end) {
        const endDate = new Date(client.contract_end);
        const daysUntilEnd = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilEnd <= 60 && daysUntilEnd > 0) {
          riskDeductions += 15;
          alerts.push({
            type: 'expiry',
            severity: daysUntilEnd <= 30 ? 'danger' : 'warning',
            message: `${client.name} contract expires in ${daysUntilEnd}d. Renewal needed.`,
          });
        } else if (daysUntilEnd <= 0) {
          riskDeductions += 25;
          alerts.push({
            type: 'expiry',
            severity: 'danger',
            message: `${client.name} contract has expired. Immediate action required.`,
          });
        }
      }
    });

    const riskScore = Math.max(0, 100 - riskDeductions);

    // Overall stability score (diversification 30%, recurring 40%, risk 30%)
    const stabilityScore = Math.round(
      diversificationScore * 0.3 +
        recurringScore * 0.4 +
        riskScore * 0.3
    );

    const metrics: RadarMetric[] = [
      {
        label: 'Diversification',
        score: diversificationScore,
        detail:
          activeClients.length === 0
            ? 'No active clients'
            : `${activeClients.length} active client${activeClients.length !== 1 ? 's' : ''}`,
      },
      {
        label: 'Recurring',
        score: recurringScore,
        detail:
          totalMRR > 0
            ? `\u00A3${totalMRR.toLocaleString()} MRR`
            : 'No recurring revenue',
      },
      {
        label: 'Risk',
        score: riskScore,
        detail:
          flaggedClients.length > 0
            ? `${flaggedClients.length} at-risk client${flaggedClients.length !== 1 ? 's' : ''}`
            : 'No flags',
      },
    ];

    return { stabilityScore, metrics, alerts, totalMRR };
  }, [clients]);

  function getScoreColor(score: number): string {
    if (score >= 70) return 'text-accent';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  }

  function getBarColor(score: number): string {
    if (score >= 70) return 'bg-accent';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-accent uppercase tracking-widest">
          Revenue Radar
        </p>
        <span
          className={cn(
            'text-[9px] px-2 py-0.5 rounded-md font-medium',
            analysis.stabilityScore >= 70
              ? 'bg-accent/15 text-accent'
              : analysis.stabilityScore >= 40
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-red-500/15 text-red-400'
          )}
        >
          {analysis.stabilityScore >= 70
            ? 'Stable'
            : analysis.stabilityScore >= 40
            ? 'Fragile'
            : 'At Risk'}
        </span>
      </div>

      {/* Stability Score + MRR */}
      <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs text-text-secondary">Stability Score</span>
            <p
              className={cn(
                'text-2xl font-mono font-bold',
                getScoreColor(analysis.stabilityScore)
              )}
            >
              {analysis.stabilityScore}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-text-secondary">Monthly Recurring</span>
            <p className="text-lg font-mono font-bold text-text-primary">
              {analysis.totalMRR > 0
                ? `\u00A3${analysis.totalMRR.toLocaleString()}`
                : '\u2014'}
            </p>
          </div>
        </div>

        {/* Radar Metrics */}
        <div className="space-y-2.5">
          {analysis.metrics.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-secondary">{metric.label}</span>
                <span className="text-[11px] text-text-tertiary">{metric.detail}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-tertiary overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      getBarColor(metric.score)
                    )}
                    style={{ width: `${metric.score}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-mono w-7 text-right', getScoreColor(metric.score))}>
                  {metric.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Alerts */}
      {analysis.alerts.length > 0 && (
        <div className="space-y-1.5">
          {analysis.alerts.map((alert, i) => (
            <div
              key={`${alert.type}-${i}`}
              className={cn(
                'flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-[11px]',
                alert.severity === 'danger'
                  ? 'bg-red-500/5 border border-red-500/15'
                  : 'bg-amber-500/5 border border-amber-500/15'
              )}
            >
              <span className="flex-shrink-0 mt-px">
                {alert.severity === 'danger' ? '!' : '\u26A0'}
              </span>
              <span
                className={cn(
                  'leading-relaxed',
                  alert.severity === 'danger' ? 'text-red-400' : 'text-amber-400'
                )}
              >
                {alert.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
