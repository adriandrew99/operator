'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { SCORE_DIMENSIONS, getScoreLevel, getScoreColor } from '@/lib/utils/score';
import type { OperatorScore, ScoreBreakdownV2 } from '@/lib/types/database';

interface OperatorScoreWidgetProps {
  todayScore: OperatorScore | null;
  streakDays: number;
}

export function OperatorScoreWidget({ todayScore, streakDays }: OperatorScoreWidgetProps) {
  const score = todayScore?.score ?? 0;
  const hasCheckedIn = todayScore?.check_in !== null && todayScore?.check_in !== undefined;
  const breakdown = todayScore?.version === 2 ? (todayScore.breakdown as ScoreBreakdownV2) : null;
  const level = getScoreLevel(score);
  const colorClass = getScoreColor(level);

  const circumference = 2 * Math.PI * 34;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <Link
      href="/score"
      className="block card-elevated p-6 hover:bg-surface-hover transition-colors duration-150 cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-section-heading text-text-primary">Operator Score</h2>
        <div className="flex items-center gap-2">
          {streakDays > 0 && (
            <span className="text-xs text-text-secondary bg-text-primary/10 px-2 py-0.5 rounded-full font-medium">
              {streakDays}d streak
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-tertiary group-hover:text-text-secondary transition-colors"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Compact score ring */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="4"
              opacity="0.2"
            />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out opacity-60"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-2xl font-bold', colorClass)}>{score}</span>
          </div>
        </div>

        {/* Mini dimension bars */}
        {breakdown ? (
          <div className="flex-1 space-y-2">
            {SCORE_DIMENSIONS.map(dim => {
              const value = breakdown[dim.key];
              const pct = dim.max > 0 ? (value / dim.max) * 100 : 0;
              const isSelfDim = !dim.auto;
              const dimDisabled = isSelfDim && !hasCheckedIn;

              return (
                <div key={dim.key} className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs w-14 text-right',
                    dimDisabled ? 'text-text-tertiary/30' : 'text-text-tertiary'
                  )}>
                    {dim.label.slice(0, 4)}
                  </span>
                  <div className="flex-1 h-1 bg-surface-tertiary overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        dimDisabled ? 'bg-surface-tertiary' :
                        pct >= 70 ? 'bg-text-primary/60' : pct >= 40 ? 'bg-text-primary/40' : 'bg-text-primary/20'
                      )}
                      style={{ width: dimDisabled ? '0%' : `${pct}%` }}
                    />
                  </div>
                  <span className={cn(
                    'text-xs font-mono w-6',
                    dimDisabled ? 'text-text-tertiary/30' : 'text-text-tertiary'
                  )}>
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1">
            <p className="text-xs text-text-tertiary">
              {todayScore ? 'Legacy score format' : 'No score yet today'}
            </p>
          </div>
        )}
      </div>

      {!hasCheckedIn && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-text-primary/5 border border-border">
          <p className="text-xs text-text-secondary">
            Check in to unlock your full score &rarr;
          </p>
        </div>
      )}
    </Link>
  );
}
