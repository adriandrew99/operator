'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WeekHeader } from './WeekHeader';
import { WeeklyGoals } from './WeeklyGoals';
import { BacklogPanel } from './BacklogPanel';
import { DayColumn } from './DayColumn';
import { TaskEditor } from './TaskEditor';
import { scheduleTaskToPeriod, suggestPlan, acceptSuggestion, acceptAllSuggestions } from '@/actions/planner';
import { upsertDayTheme, clearDayTheme } from '@/actions/planner';
import { unscheduleTask } from '@/actions/calendar';
import { updateTask, completeTask, reactivateTask, deleteTask } from '@/actions/tasks';
import { DAILY_CAPACITY } from '@/lib/utils/mental-load';
import type { Task, Client, CalendarEvent, WeeklyGoal, DayTheme, TimePeriod } from '@/lib/types/database';
import type { SuggestionResult } from '@/actions/planner';
import { cn } from '@/lib/utils/cn';

interface WeekStrategyBoardProps {
  weekStart: string;
  tasks: Task[];
  scheduledTasks: Task[];
  completedScheduledTasks?: Task[];
  unscheduledTasks: Task[];
  calendarEvents: CalendarEvent[];
  clients?: Client[];
  dailyCapacity?: number;
  weeklyGoals: WeeklyGoal[];
  dayThemes: DayTheme[];
}

export function WeekStrategyBoard({
  weekStart,
  tasks,
  scheduledTasks,
  completedScheduledTasks = [],
  unscheduledTasks,
  calendarEvents,
  clients = [],
  dailyCapacity,
  weeklyGoals,
  dayThemes,
}: WeekStrategyBoardProps) {
  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const router = useRouter();

  // ━━━ State ━━━
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ date: string; period: TimePeriod } | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const start = new Date(weekStart + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d.toISOString().split('T')[0] === todayStr) return i;
    }
    return 0;
  });

  // ━━━ Derived data ━━━
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

  const themeMap = useMemo(() => {
    const map: Record<number, DayTheme> = {};
    for (const t of dayThemes) map[t.day_index] = t;
    return map;
  }, [dayThemes]);

  // ━━━ Navigation ━━━
  function navigateWeek(offset: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + offset * 7);
    router.replace(`/planner?week=${d.toISOString().split('T')[0]}`);
  }

  function goToCurrentWeek() {
    router.replace('/planner');
  }

  // ━━━ Drag-and-Drop ━━━
  const handleDragOver = useCallback((date: string, period: TimePeriod) => {
    setDragOverTarget({ date, period });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback(async (date: string, period: TimePeriod) => {
    if (!dragTaskId) return;
    setDragOverTarget(null);
    const taskId = dragTaskId;
    setDragTaskId(null);
    await scheduleTaskToPeriod(taskId, date, period);
  }, [dragTaskId]);

  // ━━━ Task Actions ━━━
  async function handleCompleteTask(taskId: string) {
    setCompletingIds(prev => new Set(prev).add(taskId));
    await completeTask(taskId);
  }

  async function handleUncompleteTask(taskId: string) {
    setCompletingIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    await reactivateTask(taskId);
  }

  async function handleUnscheduleTask(taskId: string) {
    setEditingTaskId(null);
    await unscheduleTask(taskId);
  }

  async function handleSaveTask(taskId: string, updates: Record<string, unknown>) {
    setEditingTaskId(null);
    await updateTask(taskId, updates);
  }

  async function handleDeleteTask(taskId: string) {
    setEditingTaskId(null);
    await deleteTask(taskId);
  }

  // ━━━ Suggest Plan ━━━
  async function handleSuggestPlan() {
    setIsPending(true);
    try {
      const results = await suggestPlan(weekStart);
      setSuggestions(results);
    } finally {
      setIsPending(false);
    }
  }

  async function handleAcceptSuggestion(taskId: string) {
    const suggestion = suggestions.find(s => s.taskId === taskId);
    if (!suggestion) return;
    setSuggestions(prev => prev.filter(s => s.taskId !== taskId));
    await acceptSuggestion(taskId, suggestion.date, suggestion.period);
  }

  async function handleRejectSuggestion(taskId: string) {
    setSuggestions(prev => prev.filter(s => s.taskId !== taskId));
  }

  async function handleAcceptAll() {
    const toAccept = suggestions.map(s => ({ taskId: s.taskId, date: s.date, period: s.period }));
    setSuggestions([]);
    await acceptAllSuggestions(toAccept);
  }

  function handleClearSuggestions() {
    setSuggestions([]);
  }

  // ━━━ Day Themes ━━━
  async function handleSetTheme(dayIndex: number, theme: string) {
    await upsertDayTheme(weekStart, dayIndex, theme);
  }

  async function handleClearTheme(dayIndex: number) {
    await clearDayTheme(weekStart, dayIndex);
  }

  // Find the editing task for the TaskEditor
  const editingTask = editingTaskId
    ? [...scheduledTasks, ...completedScheduledTasks, ...unscheduledTasks].find(t => t.id === editingTaskId) || null
    : null;

  return (
    <div className="space-y-4">
      {/* Week Header */}
      <WeekHeader
        weekStart={weekStart}
        weekDates={weekDates}
        scheduledTasks={scheduledTasks}
        capacity={capacity}
        isCurrentWeek={isCurrentWeek}
        hasSuggestions={suggestions.length > 0}
        hideCompleted={hideCompleted}
        isPending={isPending}
        onNavigateWeek={navigateWeek}
        onGoToCurrentWeek={goToCurrentWeek}
        onSuggestPlan={handleSuggestPlan}
        onAcceptAll={handleAcceptAll}
        onClearSuggestions={handleClearSuggestions}
        onToggleHideCompleted={() => setHideCompleted(h => !h)}
      />

      {/* Weekly Goals */}
      <WeeklyGoals goals={weeklyGoals} weekStart={weekStart} />

      {/* Backlog */}
      <BacklogPanel
        tasks={unscheduledTasks}
        clients={clients}
        onDragStart={(id) => setDragTaskId(id)}
        onDragEnd={() => setDragTaskId(null)}
        dragTaskId={dragTaskId}
      />

      {/* Desktop: 7-day grid */}
      <div className="hidden md:grid md:grid-cols-7 gap-1.5">
        {weekDates.map((date, i) => (
          <DayColumn
            key={date}
            date={date}
            dayIndex={i}
            theme={themeMap[i] || null}
            scheduledTasks={scheduledTasks}
            completedTasks={completedScheduledTasks}
            calendarEvents={calendarEvents.filter(e => e.date === date)}
            suggestions={suggestions}
            clients={clients}
            capacity={capacity}
            isToday={date === today}
            isPast={date < today}
            dragOverTarget={dragOverTarget}
            editingTaskId={editingTaskId}
            completingIds={completingIds}
            hideCompleted={hideCompleted}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTaskDragStart={(id) => setDragTaskId(id)}
            onTaskDragEnd={() => setDragTaskId(null)}
            onEditTask={(id) => setEditingTaskId(editingTaskId === id ? null : id)}
            onCompleteTask={handleCompleteTask}
            onUncompleteTask={handleUncompleteTask}
            onUnscheduleTask={handleUnscheduleTask}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onSetTheme={(theme) => handleSetTheme(i, theme)}
            onClearTheme={() => handleClearTheme(i)}
          />
        ))}
      </div>

      {/* Mobile: Day switcher + single column */}
      <div className="md:hidden">
        {/* Day pills */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
          {weekDates.map((date, i) => {
            const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
            const dateNum = new Date(date + 'T00:00:00').getDate();
            const isSelected = i === mobileDayIndex;
            return (
              <button
                key={date}
                onClick={() => setMobileDayIndex(i)}
                className={cn(
                  'flex flex-col items-center px-3 py-1.5 rounded-xl text-[11px] transition-colors shrink-0 cursor-pointer',
                  isSelected ? 'bg-accent text-white' : date === today ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                <span className="font-medium">{dayNames[i]}</span>
                <span className="text-[9px]">{dateNum}</span>
              </button>
            );
          })}
        </div>

        {/* Single day column */}
        <DayColumn
          date={weekDates[mobileDayIndex]}
          dayIndex={mobileDayIndex}
          theme={themeMap[mobileDayIndex] || null}
          scheduledTasks={scheduledTasks}
          completedTasks={completedScheduledTasks}
          calendarEvents={calendarEvents.filter(e => e.date === weekDates[mobileDayIndex])}
          suggestions={suggestions}
          clients={clients}
          capacity={capacity}
          isToday={weekDates[mobileDayIndex] === today}
          isPast={weekDates[mobileDayIndex] < today}
          dragOverTarget={dragOverTarget}
          editingTaskId={editingTaskId}
          completingIds={completingIds}
          hideCompleted={hideCompleted}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onTaskDragStart={(id) => setDragTaskId(id)}
          onTaskDragEnd={() => setDragTaskId(null)}
          onEditTask={(id) => setEditingTaskId(editingTaskId === id ? null : id)}
          onCompleteTask={handleCompleteTask}
          onUncompleteTask={handleUncompleteTask}
          onUnscheduleTask={handleUnscheduleTask}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          onSetTheme={(theme) => handleSetTheme(mobileDayIndex, theme)}
          onClearTheme={() => handleClearTheme(mobileDayIndex)}
        />
      </div>

      {/* Floating Task Editor */}
      {editingTask && (
        <div className="fixed inset-0 z-40" onClick={() => setEditingTaskId(null)}>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <TaskEditor
                task={editingTask}
                clients={clients}
                onSave={(updates) => handleSaveTask(editingTask.id, updates)}
                onClose={() => setEditingTaskId(null)}
                onDelete={() => handleDeleteTask(editingTask.id)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
