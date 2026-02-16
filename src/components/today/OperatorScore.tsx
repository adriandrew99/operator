'use client';

import { cn } from '@/lib/utils/cn';
import { useEffect, useState } from 'react';
import { calculateOperatorScore, type ScoreBreakdown } from '@/lib/utils/score';
import { saveOperatorScore } from '@/actions/today';

interface OperatorScoreProps {
  todayTasksCompleted: number;
  todayTasksTotal: number;
  healthFundamentalsHit: number;
  healthFundamentalsTotal: number;
  streakDays: number;
}

export function OperatorScore({
  todayTasksCompleted,
  todayTasksTotal,
  healthFundamentalsHit,
  healthFundamentalsTotal,
  streakDays,
}: OperatorScoreProps) {
  const [breakdown, setBreakdown] = useState<ScoreBreakdown>(() =>
    calculateOperatorScore(todayTasksCompleted, todayTasksTotal, healthFundamentalsHit, healthFundamentalsTotal, streakDays)
  );

  useEffect(() => {
    const newBreakdown = calculateOperatorScore(
      todayTasksCompleted,
      todayTasksTotal,
      healthFundamentalsHit,
      healthFundamentalsTotal,
      streakDays
    );
    setBreakdown(newBreakdown);

    saveOperatorScore(newBreakdown.total, {
      fundamentals: newBreakdown.health,
      objectives: newBreakdown.work,
      deepWork: newBreakdown.growth,
      streak: 0,
    });
  }, [todayTasksCompleted, todayTasksTotal, healthFundamentalsHit, healthFundamentalsTotal, streakDays]);

  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference * (1 - breakdown.total / 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="5"
              opacity="0.3"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
              style={{ filter: 'drop-shadow(0 0 6px var(--glow-accent))' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-text-primary">
              {breakdown.total}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 flex-1">
          <ScoreLine label="Work" emoji="&#x1F4BC;" value={breakdown.work} max={40} />
          <ScoreLine label="Health" emoji="&#x1F3CB;&#xFE0F;" value={breakdown.health} max={40} />
          <ScoreLine label="Growth" emoji="&#x1F4C8;" value={breakdown.growth} max={20} />
        </div>
      </div>
    </div>
  );
}

function ScoreLine({ label, emoji, value, max }: { label: string; emoji: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{emoji}</span>
          <span className="text-[11px] text-text-secondary font-medium">{label}</span>
        </div>
        <span className="text-[11px] text-text-tertiary font-mono">{value}/{max}</span>
      </div>
      <div className="w-full h-1.5 bg-surface-tertiary overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct >= 70 ? 'bg-accent' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
