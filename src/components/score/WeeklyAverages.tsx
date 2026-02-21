'use client';

import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';

interface WeeklyAveragesProps {
  weeks: {
    weekStart: string;
    avg: number;
    count: number;
    checkedInCount: number;
  }[];
}

export function WeeklyAverages({ weeks }: WeeklyAveragesProps) {
  const maxAvg = Math.max(...weeks.map(w => w.avg), 1);

  return (
    <div className="space-y-3">
      {weeks.map((week, i) => {
        const barPct = (week.avg / 100) * 100;
        const checkInPct = week.count > 0 ? Math.round((week.checkedInCount / week.count) * 100) : 0;
        const isLatest = i === 0;

        return (
          <div key={week.weekStart} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-medium',
                  isLatest ? 'text-text-primary' : 'text-text-secondary'
                )}>
                  w/c {formatDate(week.weekStart)}
                </span>
                {isLatest && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface-tertiary text-text-primary font-medium">
                    This week
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary">
                  {week.count}d logged, {checkInPct}% checked in
                </span>
                <span className={cn(
                  'text-sm font-semibold font-mono',
                  week.avg >= 70 ? 'text-text-primary' : week.avg >= 50 ? 'text-text-secondary' : 'text-text-tertiary'
                )}>
                  {week.avg}
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-surface-tertiary overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  week.avg >= 70 ? 'bg-text-primary' : week.avg >= 50 ? 'bg-text-secondary' : 'bg-text-tertiary'
                )}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
