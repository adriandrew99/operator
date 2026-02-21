'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { scheduleTask, unscheduleTask, autoScheduleTasks, createCalendarEvent, deleteCalendarEvent } from '@/actions/calendar';
import { updateTask, completeTask, reactivateTask, deleteTask } from '@/actions/tasks';
import { calculateDailyLoad, getLoadLevel, getLoadColor, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import { useRouter } from 'next/navigation';
import type { Task, CalendarEvent, Client } from '@/lib/types/database';

interface WeeklyPlannerProps {
  weekStart: string;
  tasks: Task[];
  scheduledTasks: Task[];
  completedScheduledTasks?: Task[];
  unscheduledTasks: Task[];
  calendarEvents: CalendarEvent[];
  clients?: Client[];
  dailyCapacity?: number;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Hourly slots from 6am to 9pm
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

const WEIGHT_COLORS: Record<string, string> = {
  high: 'border-l-text-primary bg-surface-tertiary',
  medium: 'border-l-text-secondary bg-surface-tertiary',
  low: 'border-l-text-tertiary ',
};

const WEIGHT_DOT: Record<string, string> = {
  high: 'bg-text-primary',
  medium: 'bg-text-secondary',
  low: 'bg-text-tertiary',
};

const EVENT_COLORS: Record<string, string> = {
  fixed: 'bg-surface-tertiary border-l-text-primary text-text-secondary',
  deep_work: 'bg-surface-tertiary border-l-text-secondary text-text-secondary',
  admin: 'bg-surface-tertiary border-l-text-tertiary text-text-secondary',
  break: 'bg-surface-tertiary border-l-text-tertiary text-text-tertiary',
};

const COMPLETED_COLORS: Record<string, string> = {
  high: 'border-l-text-primary/30 ',
  medium: 'border-l-text-secondary/30 ',
  low: 'border-l-text-tertiary/30 ',
};

function formatHour(h: number): string {
  if (h === 0 || h === 12) return h === 0 ? '12am' : '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/** Parse a time block string into {hour, minutes}. Handles both "9" (legacy) and "9:30" formats */
function parseTimeBlock(tb: string | null): { hour: number; minutes: number } {
  if (!tb) return { hour: 9, minutes: 0 };
  if (tb.includes(':')) {
    const [h, m] = tb.split(':').map(Number);
    return { hour: h, minutes: m || 0 };
  }
  return { hour: parseInt(tb, 10) || 9, minutes: 0 };
}

/** Convert {hour, minutes} to total minutes from midnight */
function toTotalMinutes(hour: number, minutes: number): number {
  return hour * 60 + minutes;
}

// Minimum height in pixels for a task block
const MIN_TASK_PX = 20;
// Minimum minutes for a task
const MIN_TASK_MINUTES = 15;

export function WeeklyPlanner({
  weekStart,
  tasks,
  scheduledTasks,
  completedScheduledTasks = [],
  unscheduledTasks,
  calendarEvents,
  clients = [],
  dailyCapacity,
}: WeeklyPlannerProps) {
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const [isPending, setIsPending] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ date: string; hour: number; quarter: number } | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  const [autoScheduleResult, setAutoScheduleResult] = useState<{ count: number; message: string } | null>(null);
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    // Default to today's day index, or Monday if not in current week
    const todayStr = new Date().toISOString().split('T')[0];
    const start = new Date(weekStart + 'T00:00:00');
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    const idx = dates.indexOf(todayStr);
    return idx >= 0 ? idx : 0;
  });
  const router = useRouter();

  // Resize state
  const [resizingTask, setResizingTask] = useState<{ taskId: string; startY: number; startMinutes: number } | null>(null);
  const [resizePreviewMinutes, setResizePreviewMinutes] = useState<number | null>(null);

  // Build week dates
  const weekDates = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(weekStart + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [weekStart]);

  const today = new Date().toISOString().split('T')[0];
  const isCurrentWeek = weekDates.includes(today);

  // Week navigation — do NOT wrap in startTransition (causes freeze)
  function navigateWeek(offset: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + (offset * 7));
    const newWeek = d.toISOString().split('T')[0];
    router.replace(`/planner?week=${newWeek}`);
  }

  function goToCurrentWeek() {
    router.replace('/planner');
  }

  const ROW_HEIGHT = 64; // px per hour row (4 quarter-slots × 16px each)
  const QUARTER_HEIGHT = ROW_HEIGHT / 4; // 16px per 15-min slot

  // Get pixel height for a task based on its minutes
  const getTaskHeightPx = useCallback((task: Task): number => {
    const minutes = (resizingTask?.taskId === task.id && resizePreviewMinutes !== null)
      ? resizePreviewMinutes
      : (task.estimated_minutes || 60);
    return Math.max(MIN_TASK_PX, (minutes / 60) * ROW_HEIGHT);
  }, [resizingTask, resizePreviewMinutes, ROW_HEIGHT]);

  // Fractional hours a task spans (for occupied cell tracking)
  const getTaskSpanHours = useCallback((task: Task): number => {
    const minutes = task.estimated_minutes || 60;
    return Math.max(MIN_TASK_MINUTES / 60, minutes / 60);
  }, []);

  // All tasks to show on calendar (active + completed), deduplicated by ID
  const allCalendarTasks = useMemo(() => {
    const seen = new Set<string>();
    const result: Task[] = [];
    // Active tasks take priority over completed duplicates
    for (const task of [...scheduledTasks, ...completedScheduledTasks]) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        if (hideCompleted && task.status === 'completed') continue;
        result.push(task);
      }
    }
    return result;
  }, [scheduledTasks, completedScheduledTasks, hideCompleted]);

  // Map tasks to starting hour cell
  const getTasksForCell = useCallback((date: string, hour: number): Task[] => {
    return allCalendarTasks.filter(t => {
      if (t.scheduled_date !== date) return false;
      const parsed = parseTimeBlock(t.scheduled_time_block);
      return parsed.hour === hour;
    });
  }, [allCalendarTasks]);

  // Track which quarter-hour slots are occupied
  const occupiedQuarters = useMemo(() => {
    const set = new Set<string>();
    for (const task of allCalendarTasks) {
      if (!task.scheduled_date || !task.scheduled_time_block) continue;
      const parsed = parseTimeBlock(task.scheduled_time_block);
      const startMin = toTotalMinutes(parsed.hour, parsed.minutes);
      const duration = task.estimated_minutes || 60;
      // Mark all quarter-slots this task covers
      for (let m = startMin; m < startMin + duration; m += 15) {
        const h = Math.floor(m / 60);
        const q = Math.floor((m % 60) / 15);
        set.add(`${task.scheduled_date}-${h}-${q}`);
      }
    }
    return set;
  }, [allCalendarTasks]);

  // Per-day mental load for header indicators
  const dayLoads = useMemo(() => {
    const loads: Record<string, { mlu: number; level: ReturnType<typeof getLoadLevel>; color: string }> = {};
    for (const date of weekDates) {
      const dayTasks = scheduledTasks.filter(t => t.scheduled_date === date);
      const mlu = calculateDailyLoad(dayTasks);
      const level = getLoadLevel(mlu, capacity);
      const color = getLoadColor(level);
      loads[date] = { mlu, level, color };
    }
    return loads;
  }, [scheduledTasks, weekDates, capacity]);

  const getEventsForCell = (date: string, hour: number): CalendarEvent[] => {
    return calendarEvents.filter(e => {
      if (e.date !== date) return false;
      const eventStartH = parseInt(e.start_time.split(':')[0], 10);
      return eventStartH === hour;
    });
  };

  const getEventHeightPx = (event: CalendarEvent): number => {
    const startH = parseInt(event.start_time.split(':')[0], 10);
    const endH = parseInt(event.end_time.split(':')[0], 10);
    const startM = parseInt(event.start_time.split(':')[1] || '0', 10);
    const endM = parseInt(event.end_time.split(':')[1] || '0', 10);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.max(MIN_TASK_PX, (totalMinutes / 60) * ROW_HEIGHT);
  };

  // ━━━ Resize handlers ━━━
  const handleResizeStart = useCallback((e: React.MouseEvent, taskId: string, currentMinutes: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingTask({ taskId, startY: e.clientY, startMinutes: currentMinutes || 60 });
    setResizePreviewMinutes(currentMinutes || 60);
  }, []);

  useEffect(() => {
    if (!resizingTask) return;

    function handleMouseMove(e: MouseEvent) {
      if (!resizingTask) return;
      const deltaY = e.clientY - resizingTask.startY;
      const deltaMinutes = Math.round((deltaY / ROW_HEIGHT) * 60 / 15) * 15; // Snap to 15min
      const newMinutes = Math.max(MIN_TASK_MINUTES, resizingTask.startMinutes + deltaMinutes);
      setResizePreviewMinutes(newMinutes);
    }

    function handleMouseUp() {
      if (!resizingTask || resizePreviewMinutes === null) {
        setResizingTask(null);
        setResizePreviewMinutes(null);
        return;
      }
      const finalMinutes = resizePreviewMinutes;
      const taskId = resizingTask.taskId;
      setResizingTask(null);
      setResizePreviewMinutes(null);

      if (finalMinutes !== resizingTask.startMinutes) {
        updateTask(taskId, { estimated_minutes: finalMinutes }).catch(err => console.error('Failed to resize task:', err));
      }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTask, resizePreviewMinutes]);

  // ━━━ Task actions (fire-and-forget — never blocks navigation) ━━━
  function handleDrop(date: string, hour: number, quarter: number) {
    if (!dragTaskId) return;
    const taskId = dragTaskId;
    setDragOver(null);
    setDragTaskId(null);

    const minutes = quarter * 15;
    const timeBlock = `${hour}:${String(minutes).padStart(2, '0')}`;
    scheduleTask(taskId, date, timeBlock).catch(e => console.error('Failed to schedule:', e));
  }

  function handleUnschedule(taskId: string) {
    unscheduleTask(taskId).catch(e => console.error('Failed to unschedule:', e));
  }

  function handleAutoSchedule() {
    if (isPending) return; // prevent double-click race
    setIsPending(true);
    setAutoScheduleResult(null);
    const timeout = setTimeout(() => {
      setIsPending(false);
      setAutoScheduleResult({ count: 0, message: 'Timed out — try again' });
    }, 15000);
    autoScheduleTasks(weekStart)
      .then(assignments => {
        clearTimeout(timeout);
        const count = assignments?.length || 0;
        setAutoScheduleResult({
          count,
          message: count > 0 ? `Scheduled ${count} task${count > 1 ? 's' : ''}` : 'No tasks to schedule',
        });
        setTimeout(() => setAutoScheduleResult(null), 4000);
      })
      .catch(e => {
        clearTimeout(timeout);
        console.error('Auto-schedule failed:', e);
        setAutoScheduleResult({ count: 0, message: 'Failed — try again' });
      })
      .finally(() => {
        clearTimeout(timeout);
        setIsPending(false);
      });
  }

  function handleQuickUpdate(taskId: string, updates: Record<string, unknown>) {
    setEditingTaskId(null);
    updateTask(taskId, updates).catch(e => console.error('Failed to update task:', e));
  }

  function handleCompleteTask(taskId: string) {
    setCompletingIds(prev => new Set(prev).add(taskId));
    completeTask(taskId).catch(e => {
      console.error('Failed to complete task:', e);
      setCompletingIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    });
  }

  function handleUncompleteTask(taskId: string) {
    reactivateTask(taskId).catch(e => console.error('Failed to reactivate:', e));
  }

  function handleDeleteTask(taskId: string) {
    setEditingTaskId(null);
    deleteTask(taskId).catch(e => console.error('Failed to delete task:', e));
  }

  function handleDeleteEvent(eventId: string) {
    deleteCalendarEvent(eventId).catch(e => console.error('Failed to delete event:', e));
  }

  function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setShowEventForm(false);
    setSelectedSlot(null);
    createCalendarEvent({
      title: form.get('title') as string,
      date: selectedSlot?.date || today,
      start_time: (form.get('start_time') as string) || `${String(selectedSlot?.hour || 9).padStart(2, '0')}:00`,
      end_time: (form.get('end_time') as string) || `${String((selectedSlot?.hour || 9) + 1).padStart(2, '0')}:00`,
      event_type: (form.get('event_type') as string) || 'fixed',
      is_recurring: form.get('is_recurring') === 'on',
      recurrence_days: form.get('is_recurring') === 'on' ? [1, 2, 3, 4, 5] : undefined,
    }).catch(err => console.error('Failed to create event:', err));
  }

  // Week label
  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const weekEndDate = new Date(weekDates[6] + 'T00:00:00');
  const weekLabel = `${weekStartDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEndDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Mobile day dates for day switcher
  const mobileDateLabel = (() => {
    const d = new Date(weekDates[mobileDayIndex] + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  })();

  // Filtered dates: on mobile show single day, desktop show all 7
  const visibleDates = weekDates; // We'll filter in the grid render

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header with week nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="heading-serif text-lg text-text-primary hidden sm:block">Planner</h1>
          <p className="text-xs text-text-tertiary mt-0.5 hidden sm:block">
            {scheduledTasks.length} scheduled · {unscheduledTasks.length} unscheduled
            {completedScheduledTasks.length > 0 && ` · ${completedScheduledTasks.length} done`}
            {scheduledTasks.length > 0 && (() => {
              const weekMLU = Math.round(calculateDailyLoad(scheduledTasks));
              const weekCapacity = capacity * 5;
              const pct = Math.round((weekMLU / weekCapacity) * 100);
              return <span className={cn('ml-1', pct > 100 ? 'text-text-primary font-semibold' : pct > 80 ? 'text-text-secondary' : '')}> · {weekMLU}/{weekCapacity} MLU ({pct}%)</span>;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Week navigation */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-surface-tertiary rounded-xl border border-border px-0.5 sm:px-1 py-0.5">
            <button onClick={() => navigateWeek(-1)} className="p-1.5 sm:p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer" title="Previous week">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button
              onClick={goToCurrentWeek}
              className={cn(
                'px-2 sm:px-3 py-1 text-xs sm:text-xs font-medium rounded-lg transition-colors min-w-0 sm:min-w-[160px] text-center cursor-pointer',
                isCurrentWeek ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {weekLabel}
            </button>
            <button onClick={() => navigateWeek(1)} className="p-1.5 sm:p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer" title="Next week">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          {completedScheduledTasks.length > 0 && (
            <button
              onClick={() => setHideCompleted(prev => !prev)}
              className={cn(
                'px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer hidden sm:block',
                hideCompleted
                  ? 'bg-surface-tertiary text-text-primary border-border-light'
                  : 'bg-surface-tertiary text-text-tertiary border-border hover:text-text-secondary'
              )}
            >
              {hideCompleted ? 'Show Completed' : 'Hide Completed'}
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={handleAutoSchedule} disabled={isPending || unscheduledTasks.length === 0}>
            {isPending ? '...' : <><span className="hidden sm:inline">Auto-</span>Schedule</>}
          </Button>
        </div>
      </div>

      {/* Mobile day switcher — horizontal scrollable day pills */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {weekDates.map((date, i) => {
          const d = new Date(date + 'T00:00:00');
          const dayNum = d.getDate();
          const isToday = date === today;
          const isSelected = i === mobileDayIndex;
          const dayLoad = dayLoads[date];
          const dayTaskCount = scheduledTasks.filter(t => t.scheduled_date === date).length;
          return (
            <button
              key={date}
              onClick={() => setMobileDayIndex(i)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition-all min-w-[48px] flex-shrink-0',
                isSelected
                  ? 'bg-surface-tertiary border-border-light text-text-primary'
                  : isToday
                    ? 'bg-surface-tertiary border-border-light text-text-primary'
                    : 'bg-surface-secondary/50 border-border text-text-secondary active:bg-surface-tertiary'
              )}
            >
              <span className="text-xs font-semibold uppercase">{DAY_NAMES[i]}</span>
              <span className={cn('text-sm font-bold', isSelected && 'text-text-primary')}>{dayNum}</span>
              {dayLoad && dayLoad.mlu > 0 && (
                <div className="flex items-center gap-1">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    dayLoad.level === 'overloaded' ? 'bg-text-primary' :
                    dayLoad.level === 'heavy' ? 'bg-text-primary' :
                    dayLoad.level === 'moderate' ? 'bg-text-secondary' : 'bg-text-tertiary'
                  )} />
                  <span className="text-xs text-text-tertiary">{dayTaskCount}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Auto-schedule result banner */}
      {autoScheduleResult && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium animate-fade-in transition-all',
          autoScheduleResult.count > 0
            ? 'bg-surface-tertiary text-text-primary border border-border-light'
            : 'bg-surface-tertiary text-text-secondary border border-border-light'
        )}>
          {autoScheduleResult.count > 0 ? '✓' : '→'} {autoScheduleResult.message}
          <button onClick={() => setAutoScheduleResult(null)} className="ml-auto text-current/50 hover:text-current cursor-pointer">✕</button>
        </div>
      )}

      {/* Unscheduled task pool */}
      {unscheduledTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary ">
              Unscheduled — drag onto calendar
            </p>
            <span className="text-xs text-text-tertiary font-mono">
              {Math.round(calculateDailyLoad(unscheduledTasks))} MLU · {unscheduledTasks.length} tasks
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 py-1">
            {unscheduledTasks
              .sort((a, b) => {
                if (a.is_urgent && !b.is_urgent) return -1;
                if (!a.is_urgent && b.is_urgent) return 1;
                const wo: Record<string, number> = { high: 0, medium: 1, low: 2 };
                return (wo[a.weight] ?? 1) - (wo[b.weight] ?? 1);
              })
              .map(task => {
                const clientName = task.client_id ? clients.find(c => c.id === task.client_id)?.name : null;
                return (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  setDragTaskId(task.id);
                  e.dataTransfer.setData('text/task-id', task.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => { setDragTaskId(null); setDragOver(null); }}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium border-l-2 border cursor-grab active:cursor-grabbing transition-all border-border',
                  'hover:-translate-y-0.5',
                  WEIGHT_COLORS[task.weight] || WEIGHT_COLORS.medium,
                  task.is_urgent && 'ring-1 ring-border-light',
                  dragTaskId === task.id && 'opacity-40'
                )}
              >
                <div className="flex items-center gap-1.5 group/chip">
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', WEIGHT_DOT[task.weight] || WEIGHT_DOT.medium)} />
                  {task.is_urgent && <span className="text-xs text-text-primary font-bold">!</span>}
                  <span className="text-text-primary truncate max-w-[140px]">{task.title}</span>
                  {clientName && (
                    <span className="text-xs text-text-tertiary/60 truncate max-w-[60px]">{clientName}</span>
                  )}
                  {task.estimated_minutes ? (
                    <span className="text-text-tertiary text-xs flex-shrink-0">{task.estimated_minutes}m</span>
                  ) : (
                    <span className="text-text-tertiary/50 text-xs flex-shrink-0">1h</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                    className="opacity-0 group-hover/chip:opacity-60 hover:!opacity-100 text-text-tertiary hover:text-danger transition-all flex-shrink-0 ml-0.5 cursor-pointer"
                    title="Delete task"
                  >
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4 pb-4">
        <div className="md:min-w-[780px]">
          {/* Day headers — hidden on mobile (we have day switcher pills above) */}
          <div className="hidden md:grid grid-cols-[56px_repeat(7,1fr)] gap-0 mb-0 sticky top-0 z-10 bg-[var(--surface)]">
            <div /> {/* Spacer */}
            {weekDates.map((date, i) => {
              const d = new Date(date + 'T00:00:00');
              const dayNum = d.getDate();
              const isToday = date === today;
              const isPast = date < today;
              const dayLoad = dayLoads[date];
              return (
                <div
                  key={date}
                  className={cn(
                    'text-center py-2 border-b border-border',
                    isToday && '',
                    isPast && 'opacity-60'
                  )}
                >
                  <p className={cn(
                    'text-xs font-medium ',
                    isToday ? 'text-text-primary' : 'text-text-tertiary'
                  )}>
                    {DAY_NAMES[i]}
                  </p>
                  <p className={cn(
                    'text-sm font-bold',
                    isToday ? 'text-text-primary' : 'text-text-primary'
                  )}>
                    {dayNum}
                  </p>
                  {/* Day load bar */}
                  {dayLoad && (
                    <div className="flex flex-col items-center gap-0.5 mt-1" title={`${Math.round(dayLoad.mlu)}/${capacity} MLU`}>
                      <div className="w-12 h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            dayLoad.mlu === 0 && 'bg-transparent',
                            dayLoad.level === 'light' && 'bg-text-tertiary',
                            dayLoad.level === 'moderate' && 'bg-text-secondary',
                            dayLoad.level === 'heavy' && 'bg-text-primary',
                            dayLoad.level === 'overloaded' && 'bg-text-primary',
                          )}
                          style={{ width: `${Math.min(100, (dayLoad.mlu / capacity) * 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-mono',
                        dayLoad.mlu === 0 ? 'text-text-tertiary/30' :
                        dayLoad.level === 'overloaded' ? 'text-text-primary font-bold' :
                        dayLoad.level === 'heavy' ? 'text-text-secondary' : 'text-text-tertiary/60'
                      )}>
                        {Math.round(dayLoad.mlu)}/{capacity}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[44px_1fr] md:grid-cols-[56px_repeat(7,1fr)] gap-0">
              {/* Time label */}
              <div className="pr-1.5 md:pr-2 text-right border-r border-border flex items-start justify-end pt-1.5" style={{ height: ROW_HEIGHT }}>
                <span className="text-xs text-text-tertiary font-medium leading-none">{formatHour(hour)}</span>
              </div>

              {/* Day cells — on mobile show only the selected day */}
              {weekDates.map((date, dateIndex) => {
                // On mobile: only render the selected day
                // We use CSS to hide on mobile + JS for the single-day filter
                const isMobileVisible = dateIndex === mobileDayIndex;
                const cellTasks = getTasksForCell(date, hour);
                const cellEvents = getEventsForCell(date, hour);
                const isToday = date === today;

                return (
                  <div
                    key={`${date}-${hour}`}
                    className={cn(
                      'border-b border-r border-border relative overflow-visible',
                      isToday && '',
                      !isMobileVisible && 'hidden md:block',
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onDoubleClick={() => { setSelectedSlot({ date, hour }); setShowEventForm(true); }}
                  >
                    {/* Quarter-hour drop zones (4 segments per hour) */}
                    {[0, 1, 2, 3].map(q => {
                      const isDropTarget = dragOver?.date === date && dragOver?.hour === hour && dragOver?.quarter === q;
                      const isSlotOccupied = occupiedQuarters.has(`${date}-${hour}-${q}`);
                      return (
                        <div
                          key={q}
                          className={cn(
                            'absolute left-0 right-0 transition-colors',
                            q < 3 && 'border-b border-border/[0.06]',
                            isDropTarget && !isSlotOccupied && 'bg-surface-tertiary',
                            isDropTarget && isSlotOccupied && 'bg-surface-tertiary',
                          )}
                          style={{ top: q * QUARTER_HEIGHT, height: QUARTER_HEIGHT }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = isSlotOccupied ? 'none' : 'move';
                            if (dragOver?.date !== date || dragOver?.hour !== hour || dragOver?.quarter !== q) {
                              setDragOver({ date, hour, quarter: q });
                            }
                          }}
                          onDragLeave={(e) => {
                            e.stopPropagation();
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                          }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (!isSlotOccupied) handleDrop(date, hour, q); }}
                        />
                      );
                    })}

                    {/* Calendar events */}
                    {cellEvents.map(event => {
                      const heightPx = getEventHeightPx(event);
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'absolute left-0.5 right-0.5 text-xs px-1.5 py-1 rounded-md border-l-2 flex items-start justify-between group/event overflow-hidden',
                            EVENT_COLORS[event.event_type] || EVENT_COLORS.fixed
                          )}
                          style={{ height: `${heightPx - 2}px`, top: 1, zIndex: 2 }}
                        >
                          <div className="flex flex-col min-w-0 gap-0.5">
                            <span className="truncate font-medium leading-tight">{event.title}</span>
                            <span className="text-xs opacity-60">
                              {event.start_time.slice(0, 5)}–{event.end_time.slice(0, 5)}
                            </span>
                          </div>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleDeleteEvent(event.id); }}
                            className="opacity-0 group-hover/event:opacity-60 hover:!opacity-100 transition-opacity ml-1 flex-shrink-0 mt-0.5"
                          >
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                          </button>
                        </div>
                      );
                    })}

                    {/* Scheduled tasks — positioned by their quarter-hour offset */}
                    {cellTasks.map(task => {
                      const parsed = parseTimeBlock(task.scheduled_time_block);
                      const offsetMinutes = parsed.minutes; // offset within this hour
                      const isCompleted = task.status === 'completed' || completingIds.has(task.id);
                      const heightPx = getTaskHeightPx(task);
                      const isEditing = editingTaskId === task.id;
                      const isResizing = resizingTask?.taskId === task.id;
                      const displayMinutes = isResizing && resizePreviewMinutes !== null
                        ? resizePreviewMinutes
                        : (task.estimated_minutes || 60);
                      const topPx = (offsetMinutes / 60) * ROW_HEIGHT + 1;

                      return (
                        <div key={task.id} className="absolute left-0.5 right-0.5" style={{ top: topPx, zIndex: isEditing ? 50 : 3 }}>
                          <div
                            draggable={!isEditing && !isCompleted && !isResizing}
                            onDragStart={(e) => {
                              if (isCompleted) return;
                              setDragTaskId(task.id);
                              e.dataTransfer.setData('text/task-id', task.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => { setDragTaskId(null); setDragOver(null); }}
                            onClick={(ev) => {
                              if (isResizing) return;
                              ev.stopPropagation();
                              if (!isCompleted) setEditingTaskId(isEditing ? null : task.id);
                            }}
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded-md border-l-2 flex flex-col justify-between group/task overflow-hidden',
                              !isEditing && !isCompleted && 'hover:ring-1 hover:ring-border-light cursor-grab active:cursor-grabbing',
                              isCompleted
                                ? COMPLETED_COLORS[task.weight] || COMPLETED_COLORS.medium
                                : (WEIGHT_COLORS[task.weight] || WEIGHT_COLORS.medium),
                              isCompleted && 'opacity-50',
                              dragTaskId === task.id && 'opacity-40',
                              isResizing && 'ring-1 ring-border-light',
                            )}
                            style={{ height: `${heightPx - 2}px` }}
                          >
                            {/* Task content */}
                            <div className="flex items-start justify-between min-w-0">
                              <div className="flex flex-col min-w-0 gap-0">
                                <div className="flex items-center gap-1">
                                  {!isCompleted && (
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); handleCompleteTask(task.id); }}
                                      className="w-3 h-3 border border-border-light rounded-sm flex-shrink-0 hover:border-border-light hover:bg-surface-tertiary transition-all cursor-pointer"
                                      title="Complete task"
                                    />
                                  )}
                                  {isCompleted && (
                                    <button
                                      onClick={(ev) => { ev.stopPropagation(); handleUncompleteTask(task.id); }}
                                      className="w-3 h-3 border border-border-light bg-surface-tertiary rounded-sm flex-shrink-0 flex items-center justify-center hover:border-border-light hover:bg-surface-tertiary transition-all cursor-pointer"
                                      title="Mark as active"
                                    >
                                      <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="text-text-tertiary" />
                                      </svg>
                                    </button>
                                  )}
                                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', WEIGHT_DOT[task.weight] || WEIGHT_DOT.medium, isCompleted && 'opacity-40')} />
                                  {task.is_urgent && !isCompleted && <span className="text-text-primary font-bold text-xs">!</span>}
                                  <span className={cn(
                                    'truncate font-medium leading-tight',
                                    isCompleted ? 'text-text-tertiary line-through' : 'text-text-primary',
                                  )}>
                                    {task.title}
                                  </span>
                                </div>
                                {displayMinutes && heightPx >= 28 && (
                                  <span className={cn(
                                    'text-xs pl-4',
                                    isCompleted ? 'text-text-tertiary/50' : 'text-text-tertiary',
                                  )}>
                                    {displayMinutes}m
                                  </span>
                                )}
                              </div>
                              {!isCompleted && (
                                <button
                                  onClick={(ev) => { ev.stopPropagation(); handleUnschedule(task.id); }}
                                  className="opacity-0 group-hover/task:opacity-60 hover:!opacity-100 transition-opacity ml-1 flex-shrink-0 mt-0.5"
                                  title="Unschedule"
                                >
                                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                </button>
                              )}
                            </div>

                            {/* Resize handle */}
                            {!isCompleted && (
                              <div
                                onMouseDown={(e) => handleResizeStart(e, task.id, task.estimated_minutes || 60)}
                                className={cn(
                                  'absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize group/resize',
                                  'flex items-center justify-center',
                                  isResizing ? 'bg-surface-tertiary' : 'hover:bg-surface-tertiary',
                                )}
                                title="Drag to resize"
                              >
                                <div className={cn(
                                  'w-6 h-0.5 rounded-full transition-opacity',
                                  isResizing ? 'bg-text-tertiary/60' : 'bg-text-tertiary/0 group-hover/resize:bg-text-tertiary/40',
                                )} />
                              </div>
                            )}
                          </div>

                          {/* Task editor popover */}
                          {isEditing && !isCompleted && (
                            <PlannerTaskEditor
                              task={task}
                              clients={clients}
                              onSave={(updates) => handleQuickUpdate(task.id, updates)}
                              onClose={() => setEditingTaskId(null)}
                              onDelete={() => handleDeleteTask(task.id)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Event creation modal */}
      <Modal open={showEventForm} onClose={() => { setShowEventForm(false); setSelectedSlot(null); }} title="Add Calendar Event">
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <Input name="title" label="Event" required placeholder="e.g., Gym, Client call, Standup" />
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="start_time"
              label="Start Time"
              type="time"
              defaultValue={selectedSlot ? `${String(selectedSlot.hour).padStart(2, '0')}:00` : '09:00'}
            />
            <Input
              name="end_time"
              label="End Time"
              type="time"
              defaultValue={selectedSlot ? `${String(selectedSlot.hour + 1).padStart(2, '0')}:00` : '10:00'}
            />
          </div>
          <Select
            name="event_type"
            label="Type"
            options={[
              { value: 'fixed', label: 'Fixed (Meeting, Gym, etc.)' },
              { value: 'deep_work', label: 'Deep Work Block' },
              { value: 'admin', label: 'Admin Block' },
              { value: 'break', label: 'Break' },
            ]}
            defaultValue="fixed"
          />
          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input type="checkbox" name="is_recurring" className="w-4 h-4 rounded border-border accent-text-primary" />
            <span className="text-xs text-text-secondary">Repeat weekly (Mon–Fri)</span>
          </label>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setShowEventForm(false); setSelectedSlot(null); }}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Adding...' : 'Add Event'}</Button>
          </div>
        </form>
      </Modal>

      {/* Resize cursor overlay — prevents text selection during drag */}
      {resizingTask && (
        <div className="fixed inset-0 z-[9999] cursor-ns-resize" style={{ pointerEvents: 'auto' }} />
      )}
    </div>
  );
}

/* ━━━ Planner Task Editor ━━━ */
function PlannerTaskEditor({
  task,
  clients,
  onSave,
  onClose,
  onDelete,
}: {
  task: Task;
  clients: Client[];
  onSave: (updates: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [weight, setWeight] = useState(task.weight || 'medium');
  const [energy, setEnergy] = useState(task.energy || 'admin');
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(task.estimated_minutes || ''));
  const [clientId, setClientId] = useState(task.client_id || '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function handleSave() {
    const updates: Record<string, unknown> = {};
    if (title !== task.title) updates.title = title;
    if (weight !== task.weight) updates.weight = weight;
    if (energy !== task.energy) updates.energy = energy;
    if (clientId !== (task.client_id || '')) updates.client_id = clientId || null;
    const mins = estimatedMinutes ? Number(estimatedMinutes) : null;
    if (mins !== task.estimated_minutes) updates.estimated_minutes = mins;
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    } else {
      onClose();
    }
  }

  const WEIGHT_BADGE_INLINE: Record<string, string> = {
    high: 'bg-text-primary text-background',
    medium: 'bg-surface-tertiary text-text-secondary',
    low: 'bg-surface-tertiary text-text-tertiary',
  };

  const ENERGY_BADGE_INLINE: Record<string, string> = {
    admin: 'bg-surface-tertiary text-text-secondary',
    creative: 'bg-surface-tertiary text-text-primary',
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-full mt-1 p-3 rounded-xl bg-surface-secondary border border-border animate-fade-in space-y-3"
      style={{ zIndex: 50, minWidth: 240 }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="w-full text-sm bg-transparent text-text-primary outline-none border-b border-border pb-2"
        autoFocus
      />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-tertiary mr-1">Weight:</span>
          {(['low', 'medium', 'high'] as const).map(w => (
            <button
              key={w}
              onClick={() => setWeight(w)}
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-md font-medium uppercase transition-all',
                weight === w ? WEIGHT_BADGE_INLINE[w] : 'text-text-tertiary/50 hover:text-text-tertiary'
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-tertiary mr-1">Energy:</span>
          {(['creative', 'admin'] as const).map(e => (
            <button
              key={e}
              onClick={() => setEnergy(e)}
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-md font-medium transition-all',
                energy === e ? ENERGY_BADGE_INLINE[e] : 'text-text-tertiary/50 hover:text-text-tertiary'
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Client:</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="text-xs bg-surface-tertiary border border-border rounded-xl px-2 py-1 text-text-secondary outline-none focus:border-border-light transition-colors"
            >
              <option value="">None</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Time:</span>
          <input
            type="number"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            placeholder="mins"
            min="0"
            className="w-16 text-xs bg-surface-tertiary border border-border rounded-xl px-2 py-1 text-text-secondary outline-none focus:border-border-light transition-colors"
          />
          <span className="text-xs text-text-tertiary">min</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button onClick={onDelete} className="text-xs text-text-tertiary hover:text-danger transition-colors px-2 py-1 cursor-pointer">Delete</button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 cursor-pointer">Cancel</button>
          <button onClick={handleSave} className="text-xs text-text-primary font-medium hover:text-text-secondary transition-colors px-2 py-1 cursor-pointer">Save</button>
        </div>
      </div>
    </div>
  );
}
