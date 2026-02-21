'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { createTask, completeTask, updateTask, getTasksForWeek } from '@/actions/tasks';
import { toggleRecurringTaskCompletion } from '@/actions/recurring';
import { AnimatedCheckbox } from '@/components/ui/AnimatedCheckbox';
import { InfoBox } from '@/components/ui/InfoBox';
import { calculateDailyLoad, getLoadLevel, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import type { Task, Client } from '@/lib/types/database';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';

interface WeekViewProps {
  weekTasks: Task[];
  todayStr: string;
  recurringTasks?: RecurringTaskWithStatus[];
  clients?: Client[];
  externalCompletedIds?: Set<string>;
  pushUndo?: (entry: import('@/hooks/useUndoStack').UndoEntry) => void;
  dailyCapacity?: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WEIGHT_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-text-primary/50',
};

const WEIGHT_BADGE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-text-primary/10 text-text-secondary',
};

const ENERGY_COLORS: Record<string, string> = {
  admin: 'bg-surface-tertiary text-text-secondary',
  creative: 'bg-purple-500/15 text-purple-400',
};


function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function jsDayToWeekIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

interface RecurringEntry {
  id: string;
  title: string;
  isRecurring: true;
  completedToday: boolean;
  weight?: string;
  energy?: string;
  client_id?: string | null;
  estimated_minutes?: number | null;
}

export function WeekView({ weekTasks, todayStr, recurringTasks = [], clients = [], externalCompletedIds = new Set(), pushUndo, dailyCapacity }: WeekViewProps) {
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickWeight, setQuickWeight] = useState<'low' | 'medium' | 'high'>('medium');
  const [quickEnergy, setQuickEnergy] = useState<'creative' | 'admin'>('admin');
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completedRecurringIds, setCompletedRecurringIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    recurringTasks.forEach(rt => { if (rt.completedToday) initial.add(rt.id); });
    return initial;
  });
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [fetchedTasks, setFetchedTasks] = useState<Task[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const monday = useMemo(() => {
    const base = getMonday(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return formatDateKey(d);
    });
  }, [monday]);

  // Fetch tasks for non-current weeks
  useEffect(() => {
    if (weekOffset === 0) {
      setFetchedTasks([]);
      return;
    }
    setLoadingWeek(true);
    const startDate = weekDays[0];
    const endDate = weekDays[6];
    getTasksForWeek(startDate, endDate)
      .then(tasks => setFetchedTasks(tasks))
      .catch(() => setFetchedTasks([]))
      .finally(() => setLoadingWeek(false));
  }, [weekOffset, weekDays]);

  // Build recurring tasks by day-of-week index (0=Mon, 6=Sun)
  const recurringByDayIndex = useMemo(() => {
    const map: Record<number, RecurringEntry[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];

    recurringTasks.forEach(rt => {
      if (!rt.is_active) return;
      const entry: RecurringEntry = {
        id: rt.id,
        title: rt.title,
        isRecurring: true,
        completedToday: rt.completedToday,
        weight: rt.weight || 'low',
        energy: rt.energy || 'admin',
        client_id: rt.client_id || null,
        estimated_minutes: rt.estimated_minutes || null,
      };

      if (rt.frequency === 'daily') {
        for (let i = 0; i < 7; i++) map[i].push(entry);
      } else if (rt.frequency === 'weekdays') {
        for (let i = 0; i < 5; i++) map[i].push(entry);
      } else if (rt.frequency === 'weekly' && rt.day_of_week !== null) {
        const idx = jsDayToWeekIndex(rt.day_of_week);
        if (map[idx]) map[idx].push(entry);
      } else if (rt.frequency === 'custom' && rt.days_of_week) {
        rt.days_of_week.forEach(d => {
          const idx = jsDayToWeekIndex(d);
          if (map[idx]) map[idx].push(entry);
        });
      }
    });
    return map;
  }, [recurringTasks]);

  // Use fetched tasks for other weeks, server-provided for current week
  const activeTasks = weekOffset === 0 ? weekTasks : fetchedTasks;

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDays.forEach(d => { map[d] = []; });
    activeTasks.forEach(task => {
      // Use scheduled_date if set (from planner), otherwise fall back to deadline
      const displayDate = task.scheduled_date || task.deadline;
      if (displayDate && map[displayDate]) {
        map[displayDate].push(task);
      }
    });
    return map;
  }, [activeTasks, weekDays]);

  const weekLabel = useMemo(() => {
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${monday.toLocaleDateString('en-GB', opts)} — ${end.toLocaleDateString('en-GB', opts)}`;
  }, [monday]);

  const totalTasks = activeTasks.length;
  const highCount = activeTasks.filter(t => t.weight === 'high').length;
  const totalEstimatedMinutes = activeTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  const mediumCount = activeTasks.filter(t => t.weight === 'medium').length;
  const lowCount = activeTasks.filter(t => t.weight === 'low').length;

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

  function handleComplete(taskId: string) {
    setCompletedIds(prev => new Set(prev).add(taskId));
    completeTask(taskId).catch(e => { console.error(e); setCompletedIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }); });
  }

  function handleRecurringToggle(recurringId: string) {
    const wasCompleted = completedRecurringIds.has(recurringId);
    setCompletedRecurringIds(prev => {
      const next = new Set(prev);
      if (wasCompleted) next.delete(recurringId);
      else next.add(recurringId);
      return next;
    });
    toggleRecurringTaskCompletion(recurringId, !wasCompleted).catch(e => console.error(e));
  }

  function handleQuickAdd() {
    if (!quickTitle.trim() || !expandedDay) return;
    const title = quickTitle.trim();
    setQuickTitle('');
    setShowQuickAdd(false);
    createTask({ title, category: 'strategy', energy: quickEnergy, weight: quickWeight, deadline: expandedDay }).catch(e => console.error(e));
  }

  function handleQuickUpdate(taskId: string, updates: Record<string, unknown>) {
    setEditingTaskId(null);
    updateTask(taskId, updates).catch(e => console.error(e));
  }

  /* ━━━ Drag & Drop ━━━ */
  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(taskId);
  }

  function handleDrop(e: React.DragEvent, targetDate: string) {
    e.preventDefault();
    setDragOverDay(null);
    setDraggingTaskId(null);

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = activeTasks.find(t => t.id === taskId);
    if (!task) return;
    const currentDate = task.scheduled_date || task.deadline;
    if (currentDate === targetDate) return;

    const isTargetToday = targetDate === todayStr;
    const previousDeadline = task.deadline;
    const previousScheduled = task.scheduled_date;
    const previousFlagged = task.flagged_for_today;
    updateTask(taskId, { deadline: targetDate, scheduled_date: targetDate, flagged_for_today: isTargetToday }).catch(e => console.error(e));
    pushUndo?.({ type: 'move', taskId, previous: { deadline: previousDeadline, scheduled_date: previousScheduled, flagged_for_today: previousFlagged } });
  }

  function handleMoveToToday(taskId: string) {
    const task = activeTasks.find(t => t.id === taskId);
    if (!task) return;
    const previousDeadline = task.deadline;
    const previousScheduled = task.scheduled_date;
    const previousFlagged = task.flagged_for_today;
    updateTask(taskId, { deadline: todayStr, scheduled_date: todayStr, flagged_for_today: true }).catch(e => console.error(e));
    pushUndo?.({ type: 'move', taskId, previous: { deadline: previousDeadline, scheduled_date: previousScheduled, flagged_for_today: previousFlagged } });
  }

  function handleDragEnd() {
    setDragOverDay(null);
    setDraggingTaskId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <p className="text-xs font-medium text-text-secondary  flex-shrink-0">Week</p>
          <InfoBox title="Week View">
            <p>See all your scheduled and recurring tasks for the week. Recurring daily tasks automatically appear on their assigned days.</p>
            <p className="mt-1">Click any day to expand it. <strong>Drag tasks</strong> between days to reschedule. <strong>Click a task</strong> to edit it. Use <strong>+ Add Task</strong> to schedule a task to a specific day.</p>
          </InfoBox>
          <span className="text-xs text-text-tertiary flex-shrink-0">{totalTasks} tasks</span>
          {highCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 flex-shrink-0">{highCount} high</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className="text-text-tertiary hover:text-text-primary transition-colors p-1 btn-press">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={() => setWeekOffset(0)} className={cn('text-xs font-medium transition-colors btn-press', weekOffset === 0 ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}>
            {weekLabel}
          </button>
          <button onClick={() => setWeekOffset(prev => prev + 1)} className="text-text-tertiary hover:text-text-primary transition-colors p-1 btn-press">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-text-secondary hover:text-text-primary transition-colors ml-1 btn-press">
              Today
            </button>
          )}
        </div>
      </div>

      {loadingWeek && (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-text-primary/20 border-t-text-primary/60 rounded-full animate-spin" />
          <span className="text-xs text-text-tertiary ml-2">Loading week...</span>
        </div>
      )}

      {/* Day strip — drop targets */}
      <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none sm:grid sm:grid-cols-7 sm:overflow-visible">
        {weekDays.map((dateStr, i) => {
          const dayTasks = tasksByDay[dateStr] || [];
          const dayRecurring = recurringByDayIndex[i] || [];
          const allCount = dayTasks.length + dayRecurring.length;
          const isToday = dateStr === todayStr;
          const isExpanded = dateStr === expandedDay;
          const dayNum = new Date(dateStr + 'T12:00:00').getDate();
          const isPast = dateStr < todayStr;
          const isDragTarget = dragOverDay === dateStr;

          return (
            <div
              key={dateStr}
              role="button"
              tabIndex={0}
              onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedDay(isExpanded ? null : dateStr); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; if (dragOverDay !== dateStr) setDragOverDay(dateStr); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverDay(dateStr); }}
              onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(e, dateStr); }}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3 px-1 sm:px-1.5 rounded-xl transition-all duration-200 cursor-pointer select-none min-w-[40px] sm:min-w-0 flex-shrink-0',
                isToday && 'bg-text-primary/5 border border-border',
                !isToday && !isExpanded && !isDragTarget && 'border border-transparent',
                isExpanded ? 'bg-text-primary/8 border-border' : 'hover:bg-surface-tertiary',
                isPast && !isToday && 'opacity-60',
                isDragTarget && 'ring-2 ring-border bg-text-primary/10 scale-[1.06]'
              )}
            >
              <span className={cn('text-xs font-medium', isToday ? 'text-text-primary' : 'text-text-tertiary')}>{DAY_LABELS[i]}</span>
              <span className={cn('text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg transition-colors', isToday ? 'bg-text-primary text-background' : 'text-text-primary')}>{dayNum}</span>
              <div className="flex gap-1 h-2.5 items-center">
                {dayTasks.slice(0, 3).map((t, j) => (
                  <div key={j} className={cn('w-1.5 h-1.5 rounded-full', WEIGHT_DOT[t.weight] || WEIGHT_DOT.medium)} />
                ))}
                {dayRecurring.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary/60" />}
                {allCount > 4 && <span className="text-xs text-text-tertiary ml-0.5">+{allCount - 4}</span>}
                {allCount === 0 && <div className="w-1.5 h-1.5 rounded-full bg-border/40" />}
              </div>
              {/* Day load bar */}
              {(() => {
                const mlu = calculateDailyLoad(dayTasks);
                if (mlu <= 0) return null;
                const level = getLoadLevel(mlu, capacity);
                return (
                  <div className="w-full px-1" title={`${Math.round(mlu)}/${capacity} MLU`}>
                    <div className="w-full h-0.5 rounded-full bg-surface-tertiary overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          level === 'light' && 'bg-text-primary/50',
                          level === 'moderate' && 'bg-text-primary/60',
                          level === 'heavy' && 'bg-amber-400',
                          level === 'overloaded' && 'bg-red-400',
                        )}
                        style={{ width: `${Math.min(100, (mlu / capacity) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Week summary stats */}
      {totalTasks > 0 && (
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap px-2 text-xs text-text-tertiary">
          <span className="font-medium">{totalTasks} tasks</span>
          {totalEstimatedMinutes > 0 && (
            <span>~{totalEstimatedMinutes >= 60 ? `${Math.round(totalEstimatedMinutes / 60)}h${totalEstimatedMinutes % 60 > 0 ? ` ${totalEstimatedMinutes % 60}m` : ''}` : `${totalEstimatedMinutes}m`} est.</span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {highCount > 0 && <span className="text-red-400 font-mono">{highCount}H</span>}
            {mediumCount > 0 && <span className="text-amber-400 font-mono">{mediumCount}M</span>}
            {lowCount > 0 && <span className="text-text-secondary font-mono">{lowCount}L</span>}
          </div>
        </div>
      )}

      {/* Expanded day detail */}
      {expandedDay && (() => {
        const dayIndex = weekDays.indexOf(expandedDay);
        const dayTasks = tasksByDay[expandedDay] || [];
        const dayRecurring = dayIndex >= 0 ? (recurringByDayIndex[dayIndex] || []) : [];

        return (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-tertiary font-medium">
                {new Date(expandedDay + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                <span className="ml-2 text-text-tertiary/60">{dayTasks.length + dayRecurring.length} items</span>
              </p>
              <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-xs text-text-secondary hover:text-text-primary transition-colors font-medium btn-press flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add Task
              </button>
            </div>

            {showQuickAdd && (
              <div className="p-2.5 rounded-xl bg-surface-tertiary border border-border animate-fade-in space-y-2">
                <input type="text" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()} placeholder="Task title..." className="w-full text-xs bg-transparent text-text-primary placeholder:text-text-tertiary/60 outline-none" autoFocus />
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    {(['low', 'medium', 'high'] as const).map(w => (
                      <button key={w} onClick={() => setQuickWeight(w)} className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium uppercase transition-all', quickWeight === w ? WEIGHT_BADGE[w] : 'text-text-tertiary/50 hover:text-text-tertiary')}>{w[0]}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {(['creative', 'admin'] as const).map(e => (
                      <button key={e} onClick={() => setQuickEnergy(e)} className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium transition-all', quickEnergy === e ? ENERGY_COLORS[e] : 'text-text-tertiary/50 hover:text-text-tertiary')}>{e}</button>
                    ))}
                  </div>
                  <button onClick={handleQuickAdd} disabled={!quickTitle.trim()} className="ml-auto text-xs text-text-primary font-medium disabled:opacity-40 btn-press">Add</button>
                </div>
              </div>
            )}

            {dayTasks.map(task => {
              const isCompleted = completedIds.has(task.id) || externalCompletedIds.has(task.id);
              const isDragging = draggingTaskId === task.id;
              const isEditing = editingTaskId === task.id;
              return (
                <div key={task.id} className="relative">
                  <div
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-2.5 py-2 px-3 rounded-xl task-row group',
                      !isEditing && 'cursor-grab active:cursor-grabbing',
                      isCompleted && 'animate-task-complete',
                      isDragging && 'opacity-40'
                    )}
                  >
                    <AnimatedCheckbox checked={isCompleted} onChange={() => handleComplete(task.id)} disabled={completedIds.has(task.id)} size="sm" />
                    {/* Drag handle */}
                    <div className="text-text-tertiary/30 group-hover:text-text-tertiary/60 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing">
                      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                        <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
                        <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                        <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
                      </svg>
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setEditingTaskId(isEditing ? null : task.id); }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', WEIGHT_DOT[task.weight] || WEIGHT_DOT.medium)} />
                        <span className={cn('text-xs flex-1 truncate transition-colors', isCompleted ? 'text-text-tertiary line-through' : 'text-text-primary')}>{task.title}</span>
                      </div>
                      {(task.client_id || task.estimated_minutes) && (
                        <div className="flex items-center gap-2 mt-0.5 ml-4">
                          {task.client_id && clientMap.has(task.client_id) && (
                            <span className="text-xs text-text-tertiary">{clientMap.get(task.client_id)}</span>
                          )}
                          {task.estimated_minutes && <span className="text-xs text-text-tertiary">~{task.estimated_minutes}m</span>}
                        </div>
                      )}
                    </div>
                    {/* Move to today + Edit on hover */}
                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {expandedDay !== todayStr && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveToToday(task.id); }}
                          className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10"
                          title="Move to today"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12h18M3 12l6-6M3 12l6 6" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTaskId(isEditing ? null : task.id); }}
                        className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10"
                        title="Edit task"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Inline editor */}
                  {isEditing && (
                    <WeekTaskEditor
                      task={task}
                      clients={clients}
                      onSave={(updates) => handleQuickUpdate(task.id, updates)}
                      onClose={() => setEditingTaskId(null)}
                    />
                  )}
                </div>
              );
            })}

            {dayRecurring.length > 0 && (
              <>
                {dayTasks.length > 0 && <div className="border-t border-border my-1" />}
                <p className="text-xs text-text-tertiary/60 ">Recurring</p>
                {dayRecurring.map(rt => {
                  const isChecked = completedRecurringIds.has(rt.id);
                  const isToday = expandedDay === todayStr;
                  return (
                    <div key={rt.id} className={cn('flex items-center gap-2.5 py-2 px-3 rounded-xl task-row group', isChecked && 'opacity-60')}>
                      {isToday ? (
                        <AnimatedCheckbox checked={isChecked} onChange={() => handleRecurringToggle(rt.id)} size="sm" />
                      ) : (
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isChecked ? 'bg-text-primary/60' : 'bg-text-tertiary/40')} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', WEIGHT_DOT[rt.weight || 'low'] || WEIGHT_DOT.low)} />
                          <span className={cn('text-xs flex-1 truncate transition-colors', isChecked ? 'text-text-tertiary line-through' : 'text-text-primary')}>{rt.title}</span>
                        </div>
                        {(rt.client_id || rt.estimated_minutes) && (
                          <div className="flex items-center gap-2 mt-0.5 ml-4">
                            {rt.client_id && clientMap.has(rt.client_id) && (
                              <span className="text-xs text-text-tertiary">{clientMap.get(rt.client_id)}</span>
                            )}
                            {rt.estimated_minutes && <span className="text-xs text-text-tertiary">~{rt.estimated_minutes}m</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {dayTasks.length === 0 && dayRecurring.length === 0 && !showQuickAdd && (
              <p className="text-xs text-text-tertiary text-center py-3">No tasks scheduled — tap &quot;Add Task&quot; to plan this day</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ━━━ Inline Task Editor for Week View ━━━ */
function WeekTaskEditor({
  task,
  clients,
  onSave,
  onClose,
}: {
  task: Task;
  clients: Client[];
  onSave: (updates: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [weight, setWeight] = useState(task.weight || 'medium');
  const [energy, setEnergy] = useState(task.energy || 'admin');
  const [clientId, setClientId] = useState(task.client_id || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(task.estimated_minutes || ''));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
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

  return (
    <div
      ref={ref}
      className="ml-10 mr-3 mt-1 mb-2 p-3 rounded-xl bg-surface-secondary border border-border animate-fade-in space-y-3"
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
                weight === w ? WEIGHT_BADGE[w] : 'text-text-tertiary/50 hover:text-text-tertiary'
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
                energy === e ? ENERGY_COLORS[e] : 'text-text-tertiary/50 hover:text-text-tertiary'
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
              className="text-xs bg-surface-tertiary border border-border rounded-xl px-2 py-1 text-text-secondary outline-none focus:border-border transition-colors"
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
            className="w-16 text-xs bg-surface-tertiary border border-border rounded-xl px-2 py-1 text-text-secondary outline-none focus:border-border transition-colors"
          />
          <span className="text-xs text-text-tertiary">min</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 cursor-pointer">Cancel</button>
        <button onClick={handleSave} className="text-xs text-text-primary font-medium hover:text-text-secondary transition-colors px-2 py-1 cursor-pointer">Save</button>
      </div>
    </div>
  );
}
