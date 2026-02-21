'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { AnimatedCheckbox } from '@/components/ui/AnimatedCheckbox';
import { completeTask, updateTask, createTask, reactivateTask, deleteTask, getTasksForWeek } from '@/actions/tasks';
import { updateRecurringTask, deleteRecurringTask, toggleRecurringTaskCompletion } from '@/actions/recurring';
import { calculateDailyLoad, getLoadLevel, getLoadColor, getLoadBgColor, getOverloadSuggestion, DAILY_CAPACITY, getTaskMLU, getEstimatedMinutes } from '@/lib/utils/mental-load';
import type { Task, Client } from '@/lib/types/database';

/** Check if a task is a virtual recurring task (synthetic ID from page.tsx) */
function isRecurringTask(taskId: string): boolean {
  return taskId.startsWith('recurring-');
}

/** Extract the real recurring task UUID from the virtual ID */
function getRecurringId(taskId: string): string {
  return taskId.slice('recurring-'.length);
}

interface TodayTasksProps {
  tasks: Task[];
  clients: Client[];
  completedTodayTasks?: Task[];
  weekTasks?: Task[];
  todayStr?: string;
  onTaskCompleted?: (taskId: string) => void;
  onTaskUncompleted?: (taskId: string) => void;
  dailyCapacity?: number;
  pushUndo?: (entry: import('@/hooks/useUndoStack').UndoEntry) => void;
  /** IDs of tasks that were undone externally (e.g. Cmd+Z from parent) — clear optimistic completion state */
  externalUncompletedIds?: Set<string>;
}

const WEIGHT_COLORS: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-text-primary/10 text-text-secondary',
};

const WEIGHT_DEFAULT_MINUTES: Record<string, number> = {
  low: 5,
  medium: 30,
  high: 60,
};

const ENERGY_COLORS: Record<string, string> = {
  admin: 'bg-surface-tertiary text-text-secondary',
  creative: 'bg-purple-500/15 text-purple-400',
};

const WEIGHT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekDates(todayStr: string): string[] {
  const today = new Date(todayStr + 'T12:00:00');
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

export function TodayTasks({ tasks, clients, completedTodayTasks = [], weekTasks = [], todayStr, onTaskCompleted, onTaskUncompleted, dailyCapacity, pushUndo, externalUncompletedIds }: TodayTasksProps) {
  const today = todayStr || new Date().toISOString().split('T')[0];
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [completingSnapshots, setCompletingSnapshots] = useState<Task[]>([]); // holds task data during animation
  const [localCompletedTasks, setLocalCompletedTasks] = useState<Task[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddForWeight, setShowAddForWeight] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newWeight, setNewWeight] = useState<'low' | 'medium' | 'high'>('medium');
  const [newEnergy, setNewEnergy] = useState<'creative' | 'admin'>('admin');
  const [newClientId, setNewClientId] = useState('');
  const [newUrgent, setNewUrgent] = useState(false);
  const [newPersonal, setNewPersonal] = useState(false);
  const [dragOverWeight, setDragOverWeight] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [movePickerTaskId, setMovePickerTaskId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([]);

  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const isToday = selectedDay === today;
  const currentWeekStart = getWeekDates(today)[0];
  const selectedWeekDates = getWeekDates(selectedDay);
  const selectedWeekStart = selectedWeekDates[0];
  const isCurrentWeek = currentWeekStart === selectedWeekStart;
  const weekDates = selectedWeekDates;
  const selectedDayIndex = weekDates.indexOf(selectedDay);
  const [fetchedDayTasks, setFetchedDayTasks] = useState<Task[]>([]);
  const [loadingDayTasks, setLoadingDayTasks] = useState(false);
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [uncompletingIds, setUncompletingIds] = useState<Set<string>>(new Set());

  // Fetch tasks for non-current weeks when cycling days, or after create/delete
  useEffect(() => {
    if (isCurrentWeek) {
      setFetchedDayTasks([]);
      return;
    }
    setLoadingDayTasks(true);
    const startDate = selectedWeekDates[0];
    const endDate = selectedWeekDates[6];
    getTasksForWeek(startDate, endDate)
      .then(tasks => {
        setFetchedDayTasks(tasks);
        setDeletedTaskIds(new Set()); // clear stale deletes after fresh fetch
      })
      .catch(() => setFetchedDayTasks([]))
      .finally(() => setLoadingDayTasks(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentWeek, selectedWeekStart, fetchTrigger]);

  // When server data updates (props change), clean up optimistic state
  useEffect(() => {
    setOptimisticTasks([]);
    // Clear completingIds/dismissedIds for tasks the server has already confirmed as completed
    const serverCompletedSet = new Set(completedTodayTasks.map(t => t.id));
    if (serverCompletedSet.size > 0) {
      setCompletingIds(prev => {
        const next = new Set(prev);
        serverCompletedSet.forEach(id => next.delete(id));
        return next.size === prev.size ? prev : next;
      });
      setDismissedIds(prev => {
        const next = new Set(prev);
        serverCompletedSet.forEach(id => next.delete(id));
        return next.size === prev.size ? prev : next;
      });
      setLocalCompletedTasks(prev => {
        const filtered = prev.filter(t => !serverCompletedSet.has(t.id));
        return filtered.length === prev.length ? prev : filtered;
      });
    }
  }, [tasks, weekTasks, completedTodayTasks]);

  // When parent signals an undo (externalUncompletedIds changes), clear those from optimistic completion state
  useEffect(() => {
    if (!externalUncompletedIds || externalUncompletedIds.size === 0) return;
    setCompletingIds(prev => {
      const next = new Set(prev);
      externalUncompletedIds.forEach(id => next.delete(id));
      return next.size === prev.size ? prev : next;
    });
    setDismissedIds(prev => {
      const next = new Set(prev);
      externalUncompletedIds.forEach(id => next.delete(id));
      return next.size === prev.size ? prev : next;
    });
    setLocalCompletedTasks(prev => {
      const filtered = prev.filter(t => !externalUncompletedIds.has(t.id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [externalUncompletedIds]);

  // Determine which tasks to show based on selected day
  // Use scheduled_date if set (from planner), otherwise fall back to deadline
  const serverTasks = (isToday
    ? tasks
    : isCurrentWeek
      ? weekTasks.filter(t => (t.scheduled_date || t.deadline) === selectedDay)
      : fetchedDayTasks.filter(t => (t.scheduled_date || t.deadline) === selectedDay)
  ).filter(t => !deletedTaskIds.has(t.id));

  // Merge server tasks with optimistic tasks (deduplicate by title)
  const serverTitles = new Set(serverTasks.map(t => t.title));
  const displayTasks = [
    ...serverTasks,
    ...optimisticTasks.filter(t => (t.scheduled_date || t.deadline) === selectedDay && !serverTitles.has(t.title)),
  ];

  // Active tasks for current view (hide after animation finishes)
  // Merge completing snapshots back into their original position so React doesn't remount DOM nodes
  const snapshotMap = new Map(completingSnapshots.map(t => [t.id, t]));
  const displayWithSnapshots = displayTasks.map(t => snapshotMap.has(t.id) ? snapshotMap.get(t.id)! : t);
  // Add any snapshots whose IDs are no longer in displayTasks (removed by server revalidation)
  const displayIds = new Set(displayTasks.map(t => t.id));
  const orphanedSnapshots = completingSnapshots.filter(t => !displayIds.has(t.id) && !dismissedIds.has(t.id));
  const activeTasks = [...displayWithSnapshots.filter(t => !dismissedIds.has(t.id)), ...orphanedSnapshots];

  // Merge server completed + locally completed (deduplicated)
  const serverCompletedIds = new Set(completedTodayTasks.map(t => t.id));
  const mergedCompleted = isToday
    ? [
        ...completedTodayTasks,
        ...localCompletedTasks.filter(t => !serverCompletedIds.has(t.id)),
      ]
    : localCompletedTasks;
  const totalTasks = displayTasks.length + mergedCompleted.length;
  const completedCount = completingIds.size + mergedCompleted.length;

  function cycleDay(offset: number) {
    // Allow cycling beyond the current week
    const currentDate = new Date(selectedDay + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + offset);
    const newDay = currentDate.toISOString().split('T')[0];
    // Don't go before today
    if (newDay < today) return;
    setSelectedDay(newDay);
    setEditingTaskId(null);
    setShowAdd(false);
  }

  const selectedDayLabel = (() => {
    if (isToday) return "Today's Tasks";
    const d = new Date(selectedDay + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  })();

  // Separate priority (urgent) tasks from the rest
  const priorityTasks = activeTasks.filter(t => t.is_urgent);
  const normalTasks = activeTasks.filter(t => !t.is_urgent);

  const grouped = normalTasks
    .sort((a, b) => (WEIGHT_ORDER[a.weight] ?? 1) - (WEIGHT_ORDER[b.weight] ?? 1))
    .reduce<Record<string, Task[]>>((acc, task) => {
      const weight = task.weight || 'medium';
      if (!acc[weight]) acc[weight] = [];
      acc[weight].push(task);
      return acc;
    }, {});

  // Mental load calculation — includes completed tasks because the day still required that effort
  // Only active tasks are used for overload suggestions (what you can still rebalance)
  // Exclude tasks currently animating (completingIds) from displayTasks since they're already in mergedCompleted via localCompletedTasks
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const stableDisplayTasks = displayTasks.filter(t => !completingIds.has(t.id));
  const allDayTasks = [...stableDisplayTasks, ...mergedCompleted];
  const dailyLoad = calculateDailyLoad(allDayTasks);
  const loadLevel = getLoadLevel(dailyLoad, capacity);
  const loadColor = getLoadColor(loadLevel);
  const overloadSuggestion = getOverloadSuggestion(activeTasks, capacity);

  const weightLabels: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  function handleComplete(taskId: string) {
    // Find the task before removing it from active list
    const task = displayTasks.find(t => t.id === taskId);
    setCompletingIds(prev => new Set(prev).add(taskId));
    // Store snapshot so task stays visible during animation even after server revalidation
    if (task) {
      setCompletingSnapshots(prev => [...prev, task]);
    }
    // Delay removal so the celebration animation plays (600ms)
    setTimeout(() => {
      setDismissedIds(prev => new Set(prev).add(taskId));
      setCompletingSnapshots(prev => prev.filter(t => t.id !== taskId));
    }, 600);
    // Immediately add to local completed so it shows in the completed section
    if (task) {
      setLocalCompletedTasks(prev => [...prev, { ...task, status: 'completed', completed_at: new Date().toISOString() }]);
    }
    // Notify parent (TodayDashboard) so WeekView can reflect this
    onTaskCompleted?.(taskId);
    // Route to correct server action based on task type
    const recurring = isRecurringTask(taskId);
    const action = recurring
      ? toggleRecurringTaskCompletion(getRecurringId(taskId), true)
      : completeTask(taskId);
    action.catch(e => {
      console.error(e);
      setCompletingIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      setDismissedIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      setCompletingSnapshots(prev => prev.filter(t => t.id !== taskId));
      setLocalCompletedTasks(prev => prev.filter(t => t.id !== taskId));
      onTaskUncompleted?.(taskId);
    });
    pushUndo?.({ type: 'complete', taskId, isRecurring: recurring, recurringId: recurring ? getRecurringId(taskId) : undefined });
  }

  function handleUncomplete(taskId: string) {
    // Trigger amber glow animation
    setUncompletingIds(prev => new Set(prev).add(taskId));
    setTimeout(() => setUncompletingIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }), 500);
    // Store snapshot for error recovery
    const allCompleted = [...completedTodayTasks, ...localCompletedTasks];
    const snapshot = allCompleted.find(t => t.id === taskId);
    // Remove from local completed immediately (optimistic)
    setLocalCompletedTasks(prev => prev.filter(t => t.id !== taskId));
    setCompletingIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    setDismissedIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    setCompletingSnapshots(prev => prev.filter(t => t.id !== taskId));
    onTaskUncompleted?.(taskId);
    // Route to correct server action based on task type
    const recurring = isRecurringTask(taskId);
    const action = recurring
      ? toggleRecurringTaskCompletion(getRecurringId(taskId), false)
      : reactivateTask(taskId);
    action.catch(e => {
      console.error('Failed to reactivate:', e);
      // Revert: put task back in completed list
      if (snapshot) {
        setLocalCompletedTasks(prev => [...prev, snapshot]);
      }
      onTaskCompleted?.(taskId);
    });
    pushUndo?.({ type: 'uncomplete', taskId, isRecurring: recurring, recurringId: recurring ? getRecurringId(taskId) : undefined });
  }

  function handleDeleteTask(taskId: string) {
    // Optimistic removal — hide immediately
    setDeletedTaskIds(prev => new Set(prev).add(taskId));
    setOptimisticTasks(prev => prev.filter(t => t.id !== taskId));

    // Route to correct server action based on task type
    const action = isRecurringTask(taskId)
      ? deleteRecurringTask(getRecurringId(taskId))
      : deleteTask(taskId);
    action
      .then(() => {
        // Refetch for non-current weeks since server revalidation won't update client state
        if (!isCurrentWeek) setFetchTrigger(prev => prev + 1);
      })
      .catch(e => {
        console.error(e);
        // Revert optimistic delete on error
        setDeletedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
      });
  }

  function handleMoveToTomorrow(taskId: string) {
    // Moving recurring tasks to a different day doesn't make sense — they recur daily
    if (isRecurringTask(taskId)) return;
    const task = displayTasks.find(t => t.id === taskId);
    const previousDeadline = task?.deadline ?? null;
    const previousFlagged = task?.flagged_for_today ?? true;
    // Calculate next day relative to the selected day, not actual today
    const nextDay = new Date(selectedDay + 'T12:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];
    // Optimistic removal from current day view
    setDeletedTaskIds(prev => new Set(prev).add(taskId));
    updateTask(taskId, { deadline: nextDayStr, scheduled_date: nextDayStr, flagged_for_today: false })
      .then(() => {
        if (!isCurrentWeek) setFetchTrigger(prev => prev + 1);
      })
      .catch(e => {
        console.error(e);
        setDeletedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
      });
    pushUndo?.({ type: 'move', taskId, previous: { deadline: previousDeadline, scheduled_date: task?.scheduled_date ?? null, flagged_for_today: previousFlagged } });
  }

  function handleMoveToDay(taskId: string, date: string) {
    if (isRecurringTask(taskId)) return;
    const task = displayTasks.find(t => t.id === taskId);
    const previousDeadline = task?.deadline ?? null;
    const previousFlagged = task?.flagged_for_today ?? true;
    const isTargetToday = date === today;
    setMovePickerTaskId(null);
    // Optimistic removal from current day view (task is moving to a different day)
    if (date !== selectedDay) {
      setDeletedTaskIds(prev => new Set(prev).add(taskId));
    }
    updateTask(taskId, { deadline: date, scheduled_date: date, flagged_for_today: isTargetToday })
      .then(() => {
        if (!isCurrentWeek) setFetchTrigger(prev => prev + 1);
      })
      .catch(e => {
        console.error(e);
        setDeletedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
      });
    pushUndo?.({ type: 'move', taskId, previous: { deadline: previousDeadline, scheduled_date: task?.scheduled_date ?? null, flagged_for_today: previousFlagged } });
  }

  function handleMoveToToday(taskId: string) {
    if (isRecurringTask(taskId)) return;
    const task = displayTasks.find(t => t.id === taskId);
    const previousDeadline = task?.deadline ?? null;
    const previousFlagged = task?.flagged_for_today ?? true;
    // Optimistic removal from current day view (moving to today)
    if (!isToday) {
      setDeletedTaskIds(prev => new Set(prev).add(taskId));
    }
    updateTask(taskId, { deadline: today, scheduled_date: today, flagged_for_today: true })
      .then(() => {
        if (!isCurrentWeek) setFetchTrigger(prev => prev + 1);
      })
      .catch(e => {
        console.error(e);
        setDeletedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
      });
    pushUndo?.({ type: 'move', taskId, previous: { deadline: previousDeadline, scheduled_date: task?.scheduled_date ?? null, flagged_for_today: previousFlagged } });
  }

  function handleAddTask(weightOverride?: string) {
    if (!newTitle.trim()) return;
    const effectiveWeight = weightOverride || newWeight;
    const titleVal = newTitle.trim();
    const clientVal = newClientId;
    const energyVal = newEnergy;
    const urgentVal = newUrgent;
    const personalVal = newPersonal;
    const deadlineVal = selectedDay;
    setIsPending(true);
    setNewTitle('');
    setNewWeight('medium');
    setNewEnergy('admin');
    setNewClientId('');
    setNewUrgent(false);
    setNewPersonal(false);
    setShowAdd(false);
    setShowAddForWeight(null);

    // Auto-assign duration based on weight
    const autoMinutes = WEIGHT_DEFAULT_MINUTES[effectiveWeight] || 30;

    // Optimistic: add task to local state immediately so it shows in the view
    const optimisticTask: Task = {
      id: `optimistic-${Date.now()}`,
      user_id: '',
      title: titleVal,
      description: null,
      category: clientVal ? 'clients' as const : 'strategy' as const,
      weight: effectiveWeight as Task['weight'],
      energy: energyVal as Task['energy'],
      estimated_minutes: autoMinutes,
      deadline: deadlineVal,
      status: 'active' as const,
      flagged_for_today: isToday,
      sort_order: 999,
      client_id: clientVal || null,
      project: null,
      sprint_id: null,
      is_high_impact: false,
      is_revenue_generating: false,
      is_low_energy: false,
      is_urgent: urgentVal,
      is_personal: personalVal,
      scheduled_date: !isToday ? deadlineVal : null,
      scheduled_time_block: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setOptimisticTasks(prev => [...prev, optimisticTask]);

    createTask({
      title: titleVal,
      category: clientVal ? 'clients' : 'strategy',
      energy: energyVal,
      weight: effectiveWeight,
      estimated_minutes: autoMinutes,
      client_id: clientVal || undefined,
      deadline: deadlineVal,
      scheduled_date: !isToday ? deadlineVal : undefined,
      flagged_for_today: isToday ? true : undefined,
      is_urgent: urgentVal || undefined,
      is_personal: personalVal || undefined,
    }).then(() => {
      // Refetch for non-current weeks so the real task replaces the optimistic one
      if (!isCurrentWeek) {
        setTimeout(() => setFetchTrigger(prev => prev + 1), 300);
      }
    }).catch(e => {
      console.error(e);
      // Revert optimistic task on error
      setOptimisticTasks(prev => prev.filter(t => t.id !== optimisticTask.id));
    }).finally(() => setIsPending(false));
  }

  function handleQuickUpdate(taskId: string, updates: Record<string, unknown>) {
    setEditingTaskId(null);
    // Route to correct server action based on task type
    const action = isRecurringTask(taskId)
      ? updateRecurringTask(getRecurringId(taskId), updates)
      : updateTask(taskId, updates);
    action
      .then(() => {
        if (!isCurrentWeek) setFetchTrigger(prev => prev + 1);
      })
      .catch(e => console.error(e));
  }

  function handleWeightDrop(e: React.DragEvent, targetWeight: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverWeight(null);
    setDraggingTaskId(null);
    const taskId = e.dataTransfer.getData('text/task-id');
    const sourceWeight = e.dataTransfer.getData('text/source-weight');
    if (!taskId || sourceWeight === targetWeight) return;

    // Always update estimated_minutes to match the new weight's default
    const WEIGHT_MINUTES: Record<string, number> = { low: 5, medium: 30, high: 60 };
    const newDefault = WEIGHT_MINUTES[targetWeight] ?? 30;
    const updates: Record<string, unknown> = {
      weight: targetWeight,
      estimated_minutes: newDefault,
    };

    // Route to correct server action based on task type
    const action = isRecurringTask(taskId)
      ? updateRecurringTask(getRecurringId(taskId), updates)
      : updateTask(taskId, updates);
    action.catch(e => console.error(e));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0">
          <button
            onClick={() => cycleDay(-1)}
            disabled={selectedDay <= today}
            className="text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors p-1.5 btn-press cursor-pointer disabled:cursor-default flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => setSelectedDay(today)}
            className={cn(
              'text-xs font-medium transition-colors btn-press cursor-pointer min-w-0 sm:min-w-[140px] text-center',
              isToday ? 'text-text-tertiary' : 'text-text-primary hover:text-text-secondary'
            )}
          >
            {selectedDayLabel}
          </button>
          <button
            onClick={() => cycleDay(1)}
            className="text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors p-1.5 btn-press cursor-pointer disabled:cursor-default flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Mental load indicator with hover explainer */}
          {allDayTasks.length > 0 && (
            <LoadBarWithTooltip
              dailyLoad={dailyLoad}
              loadLevel={loadLevel}
              loadColor={loadColor}
              allDayTasks={allDayTasks}
              capacity={capacity}
            />
          )}
          <p className="text-xs text-text-tertiary whitespace-nowrap">
            {completedCount}/{totalTasks}
          </p>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs sm:text-xs text-text-secondary hover:text-text-primary font-medium btn-press flex items-center gap-1 transition-colors px-2 py-1.5 sm:py-1 -mr-1 rounded-lg active:scale-95 active:bg-text-primary/10 flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="sm:w-3 sm:h-3"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Inline task creation */}
      {showAdd && (
        <div className="p-3 sm:p-4 rounded-xl bg-surface-tertiary border border-border space-y-3 animate-fade-in">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder={isToday ? 'What needs doing today?' : `Add task for ${new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}`}
            className="w-full text-sm bg-transparent text-text-primary placeholder:text-text-tertiary/50 outline-none py-1"
            autoFocus
          />
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-0.5">
              {(['low', 'medium', 'high'] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setNewWeight(w)}
                  className={cn(
                    'text-xs px-2 py-1 sm:px-2.5 rounded-md font-medium uppercase transition-all active:scale-95',
                    newWeight === w ? WEIGHT_COLORS[w] : 'text-text-tertiary/50 hover:text-text-tertiary'
                  )}
                >
                  {w === 'medium' ? 'med' : w}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {(['creative', 'admin'] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setNewEnergy(e)}
                  className={cn(
                    'text-xs px-2 py-1 sm:px-2.5 rounded-md font-medium transition-all active:scale-95',
                    newEnergy === e ? ENERGY_COLORS[e] : 'text-text-tertiary/50 hover:text-text-tertiary'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <button
              onClick={() => setNewUrgent(!newUrgent)}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 sm:px-2.5 rounded-md font-medium transition-all active:scale-95 cursor-pointer',
                newUrgent ? 'bg-amber-500/15 text-amber-400' : 'text-text-tertiary/50 hover:text-amber-400 hover:bg-amber-500/10'
              )}
              title="Mark as Top Priority"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={newUrgent ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="hidden sm:inline">Priority</span>
            </button>
            <button
              onClick={() => setNewPersonal(!newPersonal)}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 sm:px-2.5 rounded-md font-medium transition-all active:scale-95 cursor-pointer',
                newPersonal ? 'bg-text-tertiary/15 text-text-secondary' : 'text-text-tertiary/50 hover:text-text-secondary hover:bg-text-tertiary/10'
              )}
              title="Mark as Personal"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={newPersonal ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="hidden sm:inline">Personal</span>
            </button>
            {clients.length > 0 && (
              <select
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="text-xs bg-surface-secondary border border-border rounded-lg px-1.5 py-1 sm:px-2.5 text-text-secondary outline-none focus:border-border transition-colors cursor-pointer max-w-[100px] sm:max-w-none"
              >
                <option value="">Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => handleAddTask()}
              disabled={isPending || !newTitle.trim()}
              className="ml-auto text-xs text-text-primary font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-press cursor-pointer px-2.5 py-1 sm:px-3 rounded-lg bg-text-primary/10 active:scale-95 flex-shrink-0"
            >
              {isPending ? '...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Overload / Heavy load callout */}
      {activeTasks.length > 0 && (loadLevel === 'overloaded' || loadLevel === 'heavy') && (
        <div className={cn(
          'flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border animate-fade-in',
          getLoadBgColor(loadLevel),
        )}>
          <div className="flex-shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loadColor}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-semibold', loadColor)}>
              {loadLevel === 'overloaded' ? 'Overloaded' : 'Near Capacity'}
            </p>
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
              {overloadSuggestion
                ? overloadSuggestion
                : `${Math.round(dailyLoad)} of ${capacity} MLU used (${Math.round((dailyLoad / capacity) * 100)}%). One more heavy task could push you over.`}
            </p>
          </div>
        </div>
      )}

      {loadingDayTasks && !isCurrentWeek && (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-text-primary/20 border-t-text-primary/60 rounded-full animate-spin" />
          <span className="text-xs text-text-tertiary ml-2">Loading tasks...</span>
        </div>
      )}
      {displayTasks.length === 0 && mergedCompleted.length === 0 && !showAdd && !loadingDayTasks && (
        <p className="text-xs text-text-tertiary py-3 text-center">
          {isToday ? 'No tasks for today. Tap + Add to create one.' : 'No tasks scheduled for this day — tap + Add to plan ahead.'}
        </p>
      )}

      {/* ━━━ Top Priority section ━━━ */}
      {priorityTasks.length > 0 && (
        <div className="space-y-1 px-2 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-text-secondary">
              Priority
            </span>
            <span className="text-xs text-text-tertiary">{priorityTasks.length}</span>
          </div>
          {priorityTasks.map((task) => {
            const isEditing = editingTaskId === task.id;
            const isDragging = draggingTaskId === task.id;
            const isCompleting = completingIds.has(task.id);
            return (
              <div key={task.id} className="relative">
                <div
                  className={cn(
                    'flex items-center gap-2.5 sm:gap-3 py-3 px-3 sm:px-4 rounded-xl task-row group',
                    isDragging && 'opacity-40',
                    isCompleting && 'animate-task-glow'
                  )}
                >
                  {/* Star icon (click to un-prioritise) */}
                  <button
                    onClick={() => handleQuickUpdate(task.id, { is_urgent: false })}
                    className="text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0 cursor-pointer"
                    title="Remove from Top Priority"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  <AnimatedCheckbox
                    checked={false}
                    onChange={() => handleComplete(task.id)}
                    disabled={completingIds.has(task.id)}
                    size="sm"
                  />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setEditingTaskId(isEditing ? null : task.id)}
                  >
                    <p className={cn(
                      'text-sm font-medium transition-all duration-300',
                      isCompleting ? 'text-text-tertiary line-through' : 'text-text-primary'
                    )}>{task.title}</p>
                    {(task.client_id || task.deadline) && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.client_id && clientMap.has(task.client_id) && (
                          <span className="text-xs text-text-tertiary">{clientMap.get(task.client_id)}</span>
                        )}
                        {task.deadline && (
                          <span className="text-xs text-text-tertiary">
                            Due {new Date(task.deadline + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all flex-shrink-0">
                    {!isRecurringTask(task.id) && !isToday && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveToToday(task.id); }}
                        className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10"
                        title="Move to today"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                      </button>
                    )}
                    {!isRecurringTask(task.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveToTomorrow(task.id); }}
                        className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10"
                        title={isToday ? 'Move to tomorrow' : 'Move to next day'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                      className="text-text-tertiary hover:text-danger transition-all p-1 rounded-lg hover:bg-danger/10"
                      title="Delete task"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4m2 0v9.33a1.33 1.33 0 0 1-1.34 1.34H4.67a1.33 1.33 0 0 1-1.34-1.34V4h9.34Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <InlineTaskEditor
                    task={task}
                    clients={clients}
                    onSave={(updates) => handleQuickUpdate(task.id, updates)}
                    onClose={() => setEditingTaskId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Active tasks grouped by weight */}
      {(['high', 'medium', 'low'] as const).map((weight) => {
        const weightTasks = grouped[weight] || [];
        const isDragOver = dragOverWeight === weight;
        return (
          <div
            key={weight}
            className={cn(
              'space-y-1.5 rounded-xl transition-all py-2 px-2',
              isDragOver && 'bg-text-primary/5 ring-1 ring-border'
            )}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; if (dragOverWeight !== weight) setDragOverWeight(weight); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverWeight(weight); }}
            onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverWeight(null); }}
            onDrop={(e) => handleWeightDrop(e, weight)}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-text-secondary">
                {weightLabels[weight] || weight}
              </span>
              <span className="text-xs text-text-tertiary">{weightTasks.length}</span>
              <button
                onClick={() => {
                  if (showAddForWeight === weight) {
                    setShowAddForWeight(null);
                    setNewTitle('');
                  } else {
                    setShowAddForWeight(weight);
                    setShowAdd(false);
                    setNewTitle('');
                    setNewWeight(weight as 'low' | 'medium' | 'high');
                  }
                }}
                className="text-text-tertiary/40 hover:text-text-secondary transition-colors ml-auto p-0.5 cursor-pointer"
                title={`Add ${weightLabels[weight] || weight} task`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>

            {showAddForWeight === weight && (
              <div className="p-3 sm:p-2.5 rounded-xl bg-surface-tertiary border border-border space-y-2.5 sm:space-y-2 mb-2 animate-fade-in">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask(weight)}
                  placeholder={`Add ${weightLabels[weight]?.toLowerCase() || weight} priority task...`}
                  className="w-full text-sm bg-transparent text-text-primary placeholder:text-text-tertiary/50 outline-none py-1 sm:py-0"
                  autoFocus
                />
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <div className="flex items-center gap-0.5">
                    {(['creative', 'admin'] as const).map(e => (
                      <button
                        key={e}
                        onClick={() => setNewEnergy(e)}
                        className={cn(
                          'text-xs px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-md font-medium transition-all active:scale-95',
                          newEnergy === e ? ENERGY_COLORS[e] : 'text-text-tertiary/50 hover:text-text-tertiary'
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setNewPersonal(!newPersonal)}
                    className={cn(
                      'flex items-center gap-1 text-xs px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-md font-medium transition-all active:scale-95 cursor-pointer',
                      newPersonal ? 'bg-text-tertiary/15 text-text-secondary' : 'text-text-tertiary/50 hover:text-text-secondary hover:bg-text-tertiary/10'
                    )}
                    title="Mark as Personal"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={newPersonal ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="hidden sm:inline">Personal</span>
                  </button>
                  {clients.length > 0 && (
                    <select
                      value={newClientId}
                      onChange={(e) => setNewClientId(e.target.value)}
                      className="text-xs bg-surface-secondary border border-border rounded-lg px-1.5 py-1 sm:px-2.5 sm:py-0.5 text-text-secondary outline-none focus:border-border transition-colors cursor-pointer max-w-[100px] sm:max-w-none"
                    >
                      <option value="">Client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => handleAddTask(weight)}
                    disabled={isPending || !newTitle.trim()}
                    className="ml-auto text-xs text-text-primary font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-press cursor-pointer px-2.5 py-1 sm:px-3 sm:py-0.5 rounded-lg bg-text-primary/10 active:scale-95 flex-shrink-0"
                  >
                    {isPending ? '...' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setShowAddForWeight(null); setNewTitle(''); }}
                    className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer px-1.5 py-1 sm:px-2 sm:py-0.5 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {weightTasks.map((task) => {
              const isEditing = editingTaskId === task.id;
              const isDragging = draggingTaskId === task.id;
              const isCompleting = completingIds.has(task.id);
              return (
                <div key={task.id} className="relative">
                  <div
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/task-id', task.id);
                      e.dataTransfer.setData('text/source-weight', task.weight || 'medium');
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingTaskId(task.id);
                    }}
                    onDragEnd={() => { setDraggingTaskId(null); setDragOverWeight(null); }}
                    className={cn(
                      'flex items-center gap-2.5 sm:gap-3 py-3 px-3 sm:px-4 rounded-xl task-row group',
                      isDragging && 'opacity-40',
                      isCompleting && 'animate-task-glow'
                    )}
                  >
                    {/* Grip handle */}
                    <div className="hidden sm:block opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing text-text-tertiary flex-shrink-0 -ml-1 mr-0">
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                        <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                        <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
                        <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
                      </svg>
                    </div>
                    <AnimatedCheckbox
                      checked={false}
                      onChange={() => handleComplete(task.id)}
                      disabled={completingIds.has(task.id)}
                      size="sm"
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setEditingTaskId(isEditing ? null : task.id)}
                    >
                      <p className={cn(
                        'text-sm transition-all duration-300',
                        isCompleting ? 'text-text-tertiary line-through' : 'text-text-primary'
                      )}>{task.title}</p>
                      {(task.client_id || task.estimated_minutes) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.client_id && clientMap.has(task.client_id) && (
                            <span className="text-xs text-text-tertiary">{clientMap.get(task.client_id)}</span>
                          )}
                          {task.estimated_minutes != null && task.estimated_minutes > 0 && (
                            <span className="text-xs text-text-tertiary">
                              ~{task.estimated_minutes >= 60 ? `${Math.round(task.estimated_minutes / 60)}h` : `${task.estimated_minutes}m`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all flex-shrink-0">
                      {/* Star / prioritise toggle */}
                      {!isRecurringTask(task.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickUpdate(task.id, { is_urgent: true }); }}
                          className="text-text-tertiary hover:text-amber-400 transition-all p-1 rounded-lg hover:bg-amber-500/10"
                          title="Mark as Top Priority"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      )}
                      {/* Move to today (from future day) — hidden for recurring tasks */}
                      {!isRecurringTask(task.id) && !isToday && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveToToday(task.id); }}
                          className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10"
                          title="Move to today"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 5l-7 7 7 7" />
                          </svg>
                        </button>
                      )}
                      {/* Move to next day — hidden for recurring tasks */}
                      {!isRecurringTask(task.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveToTomorrow(task.id); }}
                          className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10"
                          title={isToday ? 'Move to tomorrow' : 'Move to next day'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                      {/* Move to specific day — hidden for recurring tasks */}
                      {!isRecurringTask(task.id) && (
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMovePickerTaskId(movePickerTaskId === task.id ? null : task.id); }}
                            className={cn(
                              'text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-text-primary/10',
                              movePickerTaskId === task.id && 'text-text-primary bg-text-primary/10'
                            )}
                            title="Move to day..."
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                          </button>
                          {movePickerTaskId === task.id && (
                            <DateMovePicker
                              currentDate={today}
                              onSelect={(date) => handleMoveToDay(task.id, date)}
                              onClose={() => setMovePickerTaskId(null)}
                            />
                          )}
                        </div>
                      )}
                      {/* Delete task */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        className="text-text-tertiary hover:text-danger transition-all p-1 rounded-lg hover:bg-danger/10"
                        title="Delete task"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <InlineTaskEditor
                      task={task}
                      clients={clients}
                      onSave={(updates) => handleQuickUpdate(task.id, updates)}
                      onClose={() => setEditingTaskId(null)}
                    />
                  )}
                </div>
              );
            })}

            {weightTasks.length === 0 && showAddForWeight !== weight && (
              <button
                onClick={() => {
                  setShowAddForWeight(weight);
                  setShowAdd(false);
                  setNewTitle('');
                  setNewWeight(weight as 'low' | 'medium' | 'high');
                }}
                className={cn(
                  'w-full py-3 text-center text-xs text-text-tertiary/40 rounded-lg border border-dashed border-border transition-all cursor-pointer hover:border-border hover:text-text-tertiary',
                  isDragOver && 'border-border text-text-tertiary bg-text-primary/5'
                )}
              >
                {isDragOver ? 'Drop here' : 'Click to add task'}
              </button>
            )}
          </div>
        );
      })}

      {/* Completed section */}
      {mergedCompleted.length > 0 && (
        <div className="pt-2 border-t border-border">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-xs font-medium text-text-tertiary hover:text-text-secondary transition-colors w-full cursor-pointer"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={cn('transition-transform', showCompleted && 'rotate-90')}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Completed ({mergedCompleted.length})
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-1.5 animate-fade-in">
              {mergedCompleted.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2.5 sm:gap-3 py-2.5 px-3 sm:px-4 rounded-xl group',
                    uncompletingIds.has(task.id) && 'animate-task-uncomplete-glow'
                  )}
                >
                  <AnimatedCheckbox
                    checked={true}
                    onChange={() => handleUncomplete(task.id)}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-tertiary line-through">{task.title}</p>
                    {(task.client_id || task.completed_at) && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.client_id && clientMap.has(task.client_id) && (
                          <span className="text-xs text-text-tertiary/50">{clientMap.get(task.client_id)}</span>
                        )}
                        {task.completed_at && (
                          <span className="text-xs text-text-tertiary/40">
                            {new Date(task.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleUncomplete(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-text-primary transition-all px-2 py-1"
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ━━━ Inline Task Editor ━━━ */
function InlineTaskEditor({
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
  const [weight, setWeight] = useState(task.weight || 'medium');
  const [energy, setEnergy] = useState(task.energy || 'admin');
  const [clientId, setClientId] = useState(task.client_id || '');
  const [title, setTitle] = useState(task.title);
  const [isPersonal, setIsPersonal] = useState(task.is_personal || false);
  const [isUrgent, setIsUrgent] = useState(task.is_urgent || false);
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
    if (isPersonal !== (task.is_personal || false)) updates.is_personal = isPersonal;
    if (isUrgent !== (task.is_urgent || false)) updates.is_urgent = isUrgent;
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    } else {
      onClose();
    }
  }

  return (
    <div
      ref={ref}
      className="ml-2 sm:ml-10 mr-1 sm:mr-3 mt-1 mb-2 p-3 rounded-xl bg-surface-secondary border border-border animate-fade-in space-y-3"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="w-full text-sm bg-transparent text-text-primary outline-none border-b border-border pb-2"
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
                weight === w ? WEIGHT_COLORS[w] : 'text-text-tertiary/50 hover:text-text-tertiary'
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
        <button
          onClick={() => setIsUrgent(!isUrgent)}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium transition-all cursor-pointer',
            isUrgent ? 'bg-amber-500/15 text-amber-400' : 'text-text-tertiary/50 hover:text-amber-400 hover:bg-amber-500/10'
          )}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill={isUrgent ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Priority
        </button>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isPersonal}
            onChange={(e) => setIsPersonal(e.target.checked)}
            className="w-3 h-3 rounded accent-text-tertiary"
          />
          <span className="text-xs text-text-tertiary">Personal</span>
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1">Cancel</button>
        <button onClick={handleSave} className="text-xs text-text-primary font-medium hover:text-text-secondary transition-colors px-2 py-1">Save</button>
      </div>
    </div>
  );
}

/* ━━━ Load Bar with Hover Tooltip ━━━ */
function LoadBarWithTooltip({
  dailyLoad,
  loadLevel,
  loadColor,
  allDayTasks,
  capacity = DAILY_CAPACITY,
}: {
  dailyLoad: number;
  loadLevel: string;
  loadColor: string;
  allDayTasks: Task[];
  capacity?: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const highCount = allDayTasks.filter(t => (t.weight || 'medium') === 'high').length;
  const medCount = allDayTasks.filter(t => (t.weight || 'medium') === 'medium').length;
  const lowCount = allDayTasks.filter(t => (t.weight || 'medium') === 'low').length;
  const pct = Math.min(100, Math.round((dailyLoad / capacity) * 100));

  const levelLabel = loadLevel === 'light' ? 'Light day' : loadLevel === 'moderate' ? 'Balanced load' : loadLevel === 'heavy' ? 'Near capacity' : 'Overloaded';

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="w-14 h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            loadLevel === 'light' && 'bg-text-primary/50',
            loadLevel === 'moderate' && 'bg-text-primary/60',
            loadLevel === 'heavy' && 'bg-amber-400',
            loadLevel === 'overloaded' && 'bg-red-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-mono font-medium', loadColor)}>
        {Math.round(dailyLoad)}/{capacity}
      </span>

      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-52 p-3 rounded-xl bg-surface-secondary border border-border animate-fade-in z-50">
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-xs font-semibold', loadColor)}>{levelLabel}</span>
            <span className="text-xs text-text-tertiary font-mono">{pct}%</span>
          </div>

          <p className="text-xs text-text-tertiary mb-2.5 leading-relaxed">
            Mental Load Units measure cognitive demand based on task weight and energy type. Daily capacity is {capacity} MLU.
          </p>

          {/* Breakdown */}
          <div className="space-y-1.5 border-t border-border pt-2">
            {highCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-400">{highCount} high</span>
                <span className="text-xs text-text-tertiary font-mono">{Math.round(calculateDailyLoad(allDayTasks.filter(t => t.weight === 'high')))} MLU</span>
              </div>
            )}
            {medCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-400">{medCount} medium</span>
                <span className="text-xs text-text-tertiary font-mono">{Math.round(calculateDailyLoad(allDayTasks.filter(t => (t.weight || 'medium') === 'medium')))} MLU</span>
              </div>
            )}
            {lowCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">{lowCount} low</span>
                <span className="text-xs text-text-tertiary font-mono">{Math.round(calculateDailyLoad(allDayTasks.filter(t => t.weight === 'low')))} MLU</span>
              </div>
            )}
          </div>

          {/* Scale reference */}
          <div className="mt-2.5 pt-2 border-t border-border">
            <p className="text-xs text-text-tertiary/60 leading-relaxed">
              Scale: high-creative = 5 · medium = 2.5 · low-admin = 0.5
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━ Date Move Picker ━━━ */
function DateMovePicker({
  currentDate,
  onSelect,
  onClose,
}: {
  currentDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(currentDate + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const todayDate = new Date(currentDate + 'T12:00:00');

  // Quick shortcuts
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(todayDate.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Next Monday
  const nextMonday = new Date(todayDate);
  const dayOfWeek = nextMonday.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  const nextMondayStr = nextMonday.toISOString().split('T')[0];

  // Build calendar grid
  const firstDay = new Date(viewDate.year, viewDate.month, 1);
  const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const monthLabel = firstDay.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  function prevMonth() {
    setViewDate(v => {
      const m = v.month === 0 ? 11 : v.month - 1;
      const y = v.month === 0 ? v.year - 1 : v.year;
      return { year: y, month: m };
    });
  }

  function nextMonth() {
    setViewDate(v => {
      const m = v.month === 11 ? 0 : v.month + 1;
      const y = v.month === 11 ? v.year + 1 : v.year;
      return { year: y, month: m };
    });
  }

  function selectDay(day: number) {
    const d = new Date(viewDate.year, viewDate.month, day, 12, 0, 0);
    onSelect(d.toISOString().split('T')[0]);
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 right-0 top-full mt-1 w-56 p-3 rounded-xl bg-surface-secondary border border-border animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick shortcuts */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => onSelect(tomorrowStr)}
          className="flex-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-text-primary/10 text-text-primary hover:bg-text-primary/15 transition-all"
        >
          Tomorrow
        </button>
        <button
          onClick={() => onSelect(nextMondayStr)}
          className="flex-1 text-xs font-medium py-1.5 px-2 rounded-lg bg-surface-tertiary text-text-secondary hover:bg-surface-tertiary transition-all"
        >
          Next Mon
        </button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="text-text-tertiary hover:text-text-primary p-0.5 transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="text-xs font-medium text-text-secondary">{monthLabel}</span>
        <button onClick={nextMonth} className="text-text-tertiary hover:text-text-primary p-0.5 transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-xs text-text-tertiary/50 text-center font-medium">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === currentDate;
          const isPast = dateStr <= currentDate;
          return (
            <button
              key={dateStr}
              onClick={() => selectDay(day)}
              disabled={isPast}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md text-xs transition-all',
                isToday && 'bg-text-primary/15 text-text-primary font-bold',
                isPast && !isToday && 'text-text-tertiary/30 cursor-default',
                !isPast && !isToday && 'text-text-secondary hover:bg-text-primary/10 hover:text-text-primary cursor-pointer'
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
