'use client';

import { cn } from '@/lib/utils/cn';
import { SCORE_DIMENSIONS, getScoreLevel, getScoreColor } from '@/lib/utils/score';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { ScoreBreakdownV2 } from '@/lib/types/database';

interface ScoreHeroProps {
  score: number;
  breakdown: ScoreBreakdownV2 | null;
  hasCheckedIn: boolean;
  streakDays: number;
  autoMetrics: {
    tasksCompleted: number;
    tasksTotal: number;
    mluDelivered: number;
    mluCapacity: number;
    fundamentalsHit: number;
    fundamentalsTotal: number;
  };
}

export function ScoreHero({ score, breakdown, hasCheckedIn, streakDays, autoMetrics }: ScoreHeroProps) {
  const level = getScoreLevel(score);
  const colorClass = getScoreColor(level);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <section className="card-elevated rounded-lg p-8">
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        {/* Score ring */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="6"
              opacity="0.2"
            />
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{}}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedNumber value={score} className={cn('text-4xl font-bold', colorClass)} duration={1000} />
            <span className="text-xs text-text-tertiary font-medium font-sans mt-0.5">
              {hasCheckedIn ? level : 'partial'}
            </span>
          </div>
        </div>

        {/* Dimension bars */}
        <div className="flex-1 w-full space-y-2.5">
          {SCORE_DIMENSIONS.map(dim => {
            const value = breakdown ? breakdown[dim.key] : 0;
            const pct = dim.max > 0 ? (value / dim.max) * 100 : 0;
            const isAutoOnly = dim.auto;
            const isSelfDim = !dim.auto;
            const dimDisabled = isSelfDim && !hasCheckedIn;

            return (
              <div key={dim.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'text-xs font-medium',
                      dimDisabled ? 'text-text-tertiary/40' : 'text-text-secondary'
                    )}>
                      {dim.label}
                    </span>
                    <span className={cn(
                      'text-xs px-1 py-0.5 rounded font-medium uppercase',
                      isAutoOnly
                        ? 'bg-surface-tertiary text-text-secondary'
                        : dimDisabled
                          ? 'bg-surface-tertiary text-text-tertiary/30'
                          : 'bg-purple-500/10 text-purple-400/70'
                    )}>
                      {isAutoOnly ? 'auto' : 'self'}
                    </span>
                  </div>
                  <span className={cn(
                    'text-xs font-mono',
                    dimDisabled ? 'text-text-tertiary/30' : 'text-text-tertiary'
                  )}>
                    {value}/{dim.max}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-tertiary overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out',
                      dimDisabled ? 'bg-surface-tertiary' :
                      pct >= 70 ? 'bg-text-primary/40' : pct >= 40 ? 'bg-text-secondary/40' : 'bg-text-tertiary/40'
                    )}
                    style={{ width: dimDisabled ? '0%' : `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border">
        <Stat label="Tasks" value={`${autoMetrics.tasksCompleted}/${autoMetrics.tasksTotal}`} />
        <Stat label="MLU" value={`${autoMetrics.mluDelivered.toFixed(1)}/${autoMetrics.mluCapacity}`} />
        <Stat label="Fundamentals" value={`${autoMetrics.fundamentalsHit}/${autoMetrics.fundamentalsTotal}`} />
        <Stat label="Streak" value={`${streakDays}d`} accent={streakDays >= 3} />
      </div>

      {!hasCheckedIn && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-text-secondary">
            Score capped at 55 without check-in. Complete your daily self-assessment below to unlock the full score.
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-text-tertiary font-medium">{label}</p>
      <p className={cn('text-sm font-semibold', accent ? 'text-text-primary' : 'text-text-primary')}>{value}</p>
    </div>
  );
}
