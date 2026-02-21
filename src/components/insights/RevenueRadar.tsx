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
    if (score >= 70) return 'text-text-primary';
    if (score >= 40) return 'text-text-secondary';
    return 'text-text-tertiary';
  }

  function getBarColor(score: number): string {
    if (score >= 70) return 'bg-accent/60';
    if (score >= 40) return 'bg-text-secondary/40';
    return 'bg-text-tertiary/40';
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <p className="text-xs font-medium text-text-tertiary">Revenue Radar</p>

      {/* Stability Score + MRR — flat, no card */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Stability Score</span>
          <p
            className={cn(
              'display-number-large leading-tight',
              getScoreColor(analysis.stabilityScore)
            )}
          >
            {analysis.stabilityScore}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Monthly Recurring</span>
          <p className="display-number-medium text-text-primary leading-tight">
            {analysis.totalMRR > 0
              ? `\u00A3${analysis.totalMRR.toLocaleString()}`
              : '\u2014'}
          </p>
        </div>
      </div>

      {/* Radar Metrics — simple text lines with thin bars */}
      <div className="space-y-3">
        {analysis.metrics.map((metric) => (
          <div key={metric.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{metric.label}</span>
              <span className="text-xs text-text-tertiary">{metric.detail}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-surface-tertiary overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    getBarColor(metric.score)
                  )}
                  style={{ width: `${metric.score}%` }}
                />
              </div>
              <span className={cn('text-xs font-mono w-7 text-right', getScoreColor(metric.score))}>
                {metric.score}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Risk Alerts — left-border accent style */}
      {analysis.alerts.length > 0 && (
        <div className="space-y-2">
          {analysis.alerts.map((alert, i) => (
            <div
              key={`${alert.type}-${i}`}
              className="border-l-2 border-border pl-3 py-1"
            >
              <p className="text-xs leading-relaxed text-text-secondary">
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
