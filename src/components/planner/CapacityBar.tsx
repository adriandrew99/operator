'use client';

import { cn } from '@/lib/utils/cn';
import type { LoadLevel } from '@/lib/utils/mental-load';

interface CapacityBarProps {
  mlu: number;
  capacity: number;
  level: LoadLevel;
  showLabel?: boolean;
  variant?: 'default' | 'compact';
  energyBreakdown?: { admin: number; creative: number };
}

const LEVEL_FILL: Record<LoadLevel, string> = {
  light: 'bg-accent',
  moderate: 'bg-accent',
  heavy: 'bg-amber-400',
  overloaded: 'bg-red-400',
};

const LEVEL_BG: Record<LoadLevel, string> = {
  light: 'bg-accent/10',
  moderate: 'bg-accent/10',
  heavy: 'bg-amber-400/10',
  overloaded: 'bg-red-400/10',
};

export function CapacityBar({
  mlu,
  capacity,
  level,
  showLabel = false,
  variant = 'default',
  energyBreakdown,
}: CapacityBarProps) {
  const pct = Math.min((mlu / capacity) * 100, 100);
  const isCompact = variant === 'compact';

  return (
    <div className={cn('w-full', isCompact ? 'space-y-0' : 'space-y-1')}>
      {showLabel && (
        <div className="flex items-center justify-between text-[9px] text-text-tertiary">
          <span>{Math.round(mlu)} MLU</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          isCompact ? 'h-1' : 'h-1.5',
          LEVEL_BG[level]
        )}
      >
        {energyBreakdown ? (
          <div className="flex h-full" style={{ width: `${pct}%` }}>
            {energyBreakdown.admin > 0 && (
              <div
                className="h-full bg-text-tertiary/60 transition-all duration-500"
                style={{
                  width: `${(energyBreakdown.admin / (energyBreakdown.admin + energyBreakdown.creative)) * 100}%`,
                }}
              />
            )}
            {energyBreakdown.creative > 0 && (
              <div
                className="h-full bg-purple-400 transition-all duration-500"
                style={{
                  width: `${(energyBreakdown.creative / (energyBreakdown.admin + energyBreakdown.creative)) * 100}%`,
                }}
              />
            )}
          </div>
        ) : (
          <div
            className={cn('h-full rounded-full transition-all duration-500', LEVEL_FILL[level])}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
