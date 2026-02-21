'use client';

import { cn } from '@/lib/utils/cn';
import { SCORE_DIMENSIONS } from '@/lib/utils/score';

interface DimensionBreakdownProps {
  averages: Record<string, number>;
}

export function DimensionBreakdown({ averages }: DimensionBreakdownProps) {
  return (
    <div className="space-y-3">
      {SCORE_DIMENSIONS.map(dim => {
        const avg = averages[dim.key] ?? 0;
        const pct = dim.max > 0 ? (avg / dim.max) * 100 : 0;

        return (
          <div key={dim.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-secondary font-medium">{dim.label}</span>
                <span className={cn(
                  'text-xs px-1 py-0.5 rounded font-medium uppercase',
                  dim.auto ? 'bg-surface-tertiary text-text-tertiary' : 'bg-surface-tertiary text-text-tertiary'
                )}>
                  {dim.auto ? 'auto' : 'self'}
                </span>
              </div>
              <span className="text-xs font-mono text-text-tertiary">
                avg {avg}/{dim.max}
              </span>
            </div>
            <div className="w-full h-2 bg-surface-tertiary overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  pct >= 70 ? 'bg-text-primary' : pct >= 40 ? 'bg-text-secondary' : 'bg-text-tertiary'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-text-tertiary pt-2">
        Averages across all V2 scores. Focus on dimensions with the most room to grow.
      </p>
    </div>
  );
}
