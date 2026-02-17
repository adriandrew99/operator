'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { PeriodSection } from './PeriodSection';
import { DayThemePicker } from './DayThemePicker';
import { CapacityBar } from './CapacityBar';
import { parseTimePeriod, getDayEnergyBreakdown } from '@/lib/utils/planner';
import { calculateDailyLoad, getLoadLevel } from '@/lib/utils/mental-load';
import type { Task, Client, TimePeriod, CalendarEvent, DayTheme } from '@/lib/types/database';
import type { SuggestionResult } from '@/actions/planner';

interface DayColumnProps {
  date: string;
  dayIndex: number;
  theme: DayTheme | null;
  scheduledTasks: Task[];
  completedTasks: Task[];
  calendarEvents: CalendarEvent[];
  suggestions: SuggestionResult[];
  clients: Client[];
  capacity: number;
  isToday: boolean;
  isPast: boolean;
  dragOverTarget: { date: string; period: TimePeriod } | null;
  editingTaskId: string | null;
  completingIds: Set<string>;
  hideCompleted: boolean;
  onDragOver: (date: string, period: TimePeriod) => void;
  onDragLeave: () => void;
  onDrop: (date: string, period: TimePeriod) => void;
  onTaskDragStart: (taskId: string) => void;
  onTaskDragEnd: () => void;
  onEditTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onUnscheduleTask: (taskId: string) => void;
  onAcceptSuggestion: (taskId: string) => void;
  onRejectSuggestion: (taskId: string) => void;
  onSetTheme: (theme: string) => void;
  onClearTheme: () => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PERIODS: TimePeriod[] = ['morning', 'afternoon', 'evening'];

export function DayColumn({
  date,
  dayIndex,
  theme,
  scheduledTasks,
  completedTasks,
  calendarEvents,
  suggestions,
  clients,
  capacity,
  isToday,
  isPast,
  dragOverTarget,
  editingTaskId,
  completingIds,
  hideCompleted,
  onDragOver,
  onDragLeave,
  onDrop,
  onTaskDragStart,
  onTaskDragEnd,
  onEditTask,
  onCompleteTask,
  onUncompleteTask,
  onUnscheduleTask,
  onAcceptSuggestion,
  onRejectSuggestion,
  onSetTheme,
  onClearTheme,
}: DayColumnProps) {
  const dateNum = new Date(date + 'T00:00:00').getDate();

  // Combine active + completed tasks for this day
  const allDayTasks = useMemo(() => {
    const seen = new Set<string>();
    const result: Task[] = [];
    for (const t of [...scheduledTasks, ...completedTasks]) {
      if (t.scheduled_date === date && !seen.has(t.id)) {
        seen.add(t.id);
        result.push(t);
      }
    }
    return result;
  }, [scheduledTasks, completedTasks, date]);

  // Per-period task groups
  const tasksByPeriod = useMemo(() => {
    const groups: Record<TimePeriod, Task[]> = { morning: [], afternoon: [], evening: [] };
    for (const t of allDayTasks) {
      const period = parseTimePeriod(t.scheduled_time_block);
      groups[period].push(t);
    }
    return groups;
  }, [allDayTasks]);

  // Suggestions for this day per period
  const suggestionsByPeriod = useMemo(() => {
    const groups: Record<TimePeriod, SuggestionResult[]> = { morning: [], afternoon: [], evening: [] };
    for (const s of suggestions.filter(s => s.date === date)) {
      groups[s.period].push(s);
    }
    return groups;
  }, [suggestions, date]);

  // MLU calculation
  const mlu = useMemo(() => calculateDailyLoad(allDayTasks), [allDayTasks]);
  const loadLevel = getLoadLevel(mlu, capacity);
  const energyBreakdown = useMemo(() => getDayEnergyBreakdown(allDayTasks, date), [allDayTasks, date]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border transition-colors',
        isToday ? 'border-accent/30 bg-accent/[0.02]' : 'border-border/50',
        isPast && 'opacity-70'
      )}
    >
      {/* Day header */}
      <div className="px-2.5 pt-2.5 pb-1.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-xs font-medium',
                isToday ? 'text-accent' : 'text-text-primary'
              )}
            >
              {DAY_NAMES[dayIndex]}
            </span>
            <span
              className={cn(
                'text-[10px] w-5 h-5 rounded-full flex items-center justify-center',
                isToday ? 'bg-accent text-white' : 'text-text-tertiary'
              )}
            >
              {dateNum}
            </span>
          </div>
          <DayThemePicker
            currentTheme={theme?.theme || null}
            onSelect={onSetTheme}
            onClear={onClearTheme}
          />
        </div>
        <CapacityBar
          mlu={mlu}
          capacity={capacity}
          level={loadLevel}
          variant="compact"
          energyBreakdown={energyBreakdown}
        />
      </div>

      {/* Period sections */}
      <div className="flex-1 px-1 pb-1.5 space-y-0.5">
        {PERIODS.map(period => (
          <PeriodSection
            key={period}
            period={period}
            date={date}
            tasks={tasksByPeriod[period]}
            events={calendarEvents}
            suggestions={suggestionsByPeriod[period]}
            clients={clients}
            isDropTarget={dragOverTarget?.date === date && dragOverTarget?.period === period}
            editingTaskId={editingTaskId}
            completingIds={completingIds}
            hideCompleted={hideCompleted}
            onDragOver={() => onDragOver(date, period)}
            onDragLeave={onDragLeave}
            onDrop={() => onDrop(date, period)}
            onTaskDragStart={onTaskDragStart}
            onTaskDragEnd={onTaskDragEnd}
            onEditTask={onEditTask}
            onCompleteTask={onCompleteTask}
            onUncompleteTask={onUncompleteTask}
            onUnscheduleTask={onUnscheduleTask}
            onAcceptSuggestion={onAcceptSuggestion}
            onRejectSuggestion={onRejectSuggestion}
          />
        ))}
      </div>
    </div>
  );
}
