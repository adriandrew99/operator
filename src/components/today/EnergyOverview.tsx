'use client';

import { cn } from '@/lib/utils/cn';
import { getTaskMLU, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import type { Task } from '@/lib/types/database';

interface EnergyOverviewProps {
  todayTasks: Task[];
  completedTodayTasks: Task[];
  dailyCapacity?: number;
}

export function EnergyOverview({
  todayTasks,
  completedTodayTasks,
  dailyCapacity,
}: EnergyOverviewProps) {
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const allTasks = [...todayTasks, ...completedTodayTasks].filter(t => !t.is_personal);
  const completedNonPersonal = completedTodayTasks.filter(t => !t.is_personal);

  // Energy split: creative vs admin MLU
  let creativeMLU = 0;
  let adminMLU = 0;
  for (const task of allTasks) {
    const mlu = getTaskMLU(task);
    const energy = task.energy || 'admin';
    if (energy === 'creative') {
      creativeMLU += mlu;
    } else {
      adminMLU += mlu;
    }
  }
  const totalMLU = creativeMLU + adminMLU;
  const creativePct = totalMLU > 0 ? (creativeMLU / totalMLU) * 100 : 0;
  const adminPct = totalMLU > 0 ? (adminMLU / totalMLU) * 100 : 0;

  // Weight distribution: how many done vs total per weight tier
  const tiers = ['high', 'medium', 'low'] as const;
  const distribution = tiers.map(weight => {
    const all = allTasks.filter(t => (t.weight || 'medium') === weight);
    const done = all.filter(t => completedNonPersonal.some(ct => ct.id === t.id));
    return { weight, total: all.length, done: done.length };
  }).filter(d => d.total > 0);

  // Remaining MLU
  const completedMLU = completedNonPersonal.reduce((sum, t) => sum + getTaskMLU(t), 0);
  const remainingMLU = Math.max(0, totalMLU - completedMLU);

  if (allTasks.length === 0) {
    return (
      <div className="empty-state py-4">
        <div className="empty-state-icon" style={{ width: 32, height: 32 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-xs text-text-tertiary">No tasks planned yet. Energy overview appears when tasks are added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Energy split bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Energy split</span>
          <span className="text-xs font-mono text-text-tertiary">
            {totalMLU.toFixed(1)} MLU
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden flex">
          {creativePct > 0 && (
            <div
              className="h-full bg-text-primary/60 transition-all duration-500"
              style={{ width: `${creativePct}%` }}
            />
          )}
          {adminPct > 0 && (
            <div
              className="h-full bg-text-tertiary/40 transition-all duration-500"
              style={{ width: `${adminPct}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-text-primary/60" />
            <span className="text-text-secondary">Creative {creativeMLU.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-text-tertiary/40" />
            <span className="text-text-secondary">Admin {adminMLU.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Weight distribution */}
      {distribution.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-xs text-text-secondary">Weight distribution</span>
          {distribution.map(({ weight, total, done }) => {
            const pct = total > 0 ? (done / total) * 100 : 0;
            return (
              <div key={weight} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs capitalize',
                    weight === 'high' ? 'text-text-primary font-medium' : 'text-text-secondary'
                  )}>
                    {weight}
                  </span>
                  <span className="text-xs font-mono text-text-tertiary">
                    {done}/{total}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-surface-tertiary overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      weight === 'high' ? 'bg-text-primary/70' : weight === 'medium' ? 'bg-text-primary/50' : 'bg-text-tertiary/50'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remaining MLU summary */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-text-secondary">Remaining</span>
        <span className={cn(
          'text-sm font-mono font-medium',
          remainingMLU === 0 ? 'text-text-primary' : 'text-text-primary'
        )}>
          {remainingMLU.toFixed(1)} <span className="text-text-tertiary text-xs font-normal">/ {capacity} MLU</span>
        </span>
      </div>
    </div>
  );
}
