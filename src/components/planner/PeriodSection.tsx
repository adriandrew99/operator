'use client';

import { cn } from '@/lib/utils/cn';
import { TaskCard } from './TaskCard';
import { GhostTaskCard } from './GhostTaskCard';
import type { Task, Client, TimePeriod, CalendarEvent } from '@/lib/types/database';
import type { SuggestionResult } from '@/actions/planner';
import { eventTimeToPeriod } from '@/lib/utils/planner';

interface PeriodSectionProps {
  period: TimePeriod;
  date: string;
  tasks: Task[];
  events: CalendarEvent[];
  suggestions: SuggestionResult[];
  clients: Client[];
  isDropTarget: boolean;
  editingTaskId: string | null;
  completingIds: Set<string>;
  hideCompleted: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onTaskDragStart: (taskId: string) => void;
  onTaskDragEnd: () => void;
  onEditTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onUnscheduleTask: (taskId: string) => void;
  onAcceptSuggestion: (taskId: string) => void;
  onRejectSuggestion: (taskId: string) => void;
}

const PERIOD_META: Record<TimePeriod, { label: string; energyHint: string; energyDot: string }> = {
  morning: { label: 'Morning', energyHint: 'Creative & deep work', energyDot: 'bg-text-primary' },
  afternoon: { label: 'Afternoon', energyHint: 'Structured work', energyDot: 'bg-text-secondary' },
  evening: { label: 'Evening', energyHint: 'Admin & light tasks', energyDot: 'bg-text-tertiary' },
};

const EVENT_COLORS: Record<string, string> = {
  fixed: 'border-l-text-primary bg-surface-tertiary text-text-secondary',
  deep_work: 'border-l-text-secondary bg-surface-tertiary text-text-secondary',
  admin: 'border-l-text-tertiary bg-surface-tertiary text-text-secondary',
  break: 'border-l-text-tertiary bg-surface-tertiary text-text-tertiary',
};

export function PeriodSection({
  period,
  date,
  tasks,
  events,
  suggestions,
  clients,
  isDropTarget,
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
}: PeriodSectionProps) {
  const meta = PERIOD_META[period];
  const clientMap = new Map(clients.map(c => [c.id, c.name]));

  // Filter events that belong to this period
  const periodEvents = events.filter(e => eventTimeToPeriod(e.start_time) === period);

  // Filter tasks
  const visibleTasks = hideCompleted
    ? tasks.filter(t => t.status !== 'completed')
    : tasks;

  return (
    <div
      className={cn(
        'min-h-[52px] rounded-lg border border-transparent transition-colors px-1.5 py-1',
        isDropTarget && 'border-border-light bg-surface-tertiary'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      {/* Period label */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('w-1.5 h-1.5 rounded-full', meta.energyDot)} />
        <span className="text-xs text-text-tertiary font-medium">
          {meta.label}
        </span>
        <span className="text-xs text-text-tertiary/50 hidden sm:inline">{meta.energyHint}</span>
      </div>

      {/* Calendar events */}
      {periodEvents.map(event => (
        <div
          key={event.id}
          className={cn(
            'border-l-2 rounded px-2 py-0.5 text-xs mb-1',
            EVENT_COLORS[event.event_type] || EVENT_COLORS.fixed
          )}
        >
          <span className="font-medium">{event.title}</span>
          <span className="ml-1.5 opacity-60">{event.start_time}–{event.end_time}</span>
        </div>
      ))}

      {/* Task cards */}
      <div className="space-y-1.5">
        {visibleTasks.map(task => (
          <div key={task.id} className="relative">
            <TaskCard
              task={task}
              clientName={task.client_id ? clientMap.get(task.client_id) || null : null}
              isCompleted={task.status === 'completed'}
              isCompleting={completingIds.has(task.id)}
              period={period}
              onDragStart={() => onTaskDragStart(task.id)}
              onDragEnd={onTaskDragEnd}
              onClick={() => onEditTask(task.id)}
              onComplete={() => onCompleteTask(task.id)}
              onUncomplete={() => onUncompleteTask(task.id)}
              onUnschedule={() => onUnscheduleTask(task.id)}
            />
          </div>
        ))}

        {/* Ghost suggestions */}
        {suggestions.map(suggestion => (
          <GhostTaskCard
            key={suggestion.taskId}
            suggestion={suggestion}
            onAccept={() => onAcceptSuggestion(suggestion.taskId)}
            onReject={() => onRejectSuggestion(suggestion.taskId)}
          />
        ))}
      </div>

      {/* Empty state */}
      {visibleTasks.length === 0 && periodEvents.length === 0 && suggestions.length === 0 && (
        <div className="text-xs text-text-tertiary/30 text-center py-2">
          Drop tasks here
        </div>
      )}
    </div>
  );
}
