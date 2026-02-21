'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { CapacityBar } from './CapacityBar';
import { calculateDailyLoad, getLoadLevel } from '@/lib/utils/mental-load';
import { getDayEnergyBreakdown } from '@/lib/utils/planner';
import type { Task } from '@/lib/types/database';

interface WeekHeaderProps {
  weekStart: string;
  weekDates: string[];
  scheduledTasks: Task[];
  capacity: number;
  isCurrentWeek: boolean;
  hasSuggestions: boolean;
  hideCompleted: boolean;
  isPending: boolean;
  onNavigateWeek: (offset: number) => void;
  onGoToCurrentWeek: () => void;
  onSuggestPlan: () => void;
  onAcceptAll: () => void;
  onClearSuggestions: () => void;
  onToggleHideCompleted: () => void;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${months[start.getMonth()]}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
}

export function WeekHeader({
  weekStart,
  weekDates,
  scheduledTasks,
  capacity,
  isCurrentWeek,
  hasSuggestions,
  hideCompleted,
  isPending,
  onNavigateWeek,
  onGoToCurrentWeek,
  onSuggestPlan,
  onAcceptAll,
  onClearSuggestions,
  onToggleHideCompleted,
}: WeekHeaderProps) {
  // Week-level capacity (capacity × number of work days — assume 5 for now)
  const workDayCount = Math.min(weekDates.length, 5);
  const weekCapacity = capacity * workDayCount;
  const weekMLU = useMemo(() => calculateDailyLoad(scheduledTasks), [scheduledTasks]);
  const weekLoadLevel = getLoadLevel(weekMLU / workDayCount, capacity); // per-day average for color

  // Energy breakdown across the whole week
  const weekEnergyBreakdown = useMemo(() => {
    let admin = 0;
    let creative = 0;
    for (const date of weekDates) {
      const breakdown = getDayEnergyBreakdown(scheduledTasks, date);
      admin += breakdown.admin;
      creative += breakdown.creative;
    }
    return { admin, creative };
  }, [scheduledTasks, weekDates]);

  return (
    <div className="space-y-3">
      {/* Top row: navigation + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateWeek(-1)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-text-tertiary hover:text-text-primary hover:border-border transition-colors cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm font-medium text-text-primary min-w-[120px] text-center">
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={() => onNavigateWeek(1)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-text-tertiary hover:text-text-primary hover:border-border transition-colors cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {!isCurrentWeek && (
            <button
              onClick={onGoToCurrentWeek}
              className="text-xs text-text-primary hover:text-text-secondary transition-colors cursor-pointer"
            >
              Today
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasSuggestions ? (
            <>
              <Button size="sm" variant="primary" onClick={onAcceptAll}>
                Accept All
              </Button>
              <Button size="sm" variant="ghost" onClick={onClearSuggestions}>
                Clear
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={onSuggestPlan} disabled={isPending}>
              {isPending ? 'Thinking...' : 'Suggest Plan'}
            </Button>
          )}
          <button
            onClick={onToggleHideCompleted}
            className={cn(
              'text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer',
              hideCompleted ? 'text-text-primary bg-surface-tertiary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {hideCompleted ? 'Show done' : 'Hide done'}
          </button>
        </div>
      </div>

      {/* Capacity summary bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <CapacityBar
            mlu={weekMLU}
            capacity={weekCapacity}
            level={weekLoadLevel}
            showLabel
            energyBreakdown={weekEnergyBreakdown}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-text-tertiary shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-text-tertiary/60" />
            Admin
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-text-primary" />
            Creative
          </span>
        </div>
      </div>
    </div>
  );
}
