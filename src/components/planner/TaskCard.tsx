'use client';

import { cn } from '@/lib/utils/cn';
import { AnimatedCheckbox } from '@/components/ui/AnimatedCheckbox';
import { EnergyMatchIndicator } from './EnergyMatchIndicator';
import type { Task, TimePeriod } from '@/lib/types/database';

interface TaskCardProps {
  task: Task;
  clientName: string | null;
  isCompleted: boolean;
  isCompleting: boolean;
  period: TimePeriod;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onUnschedule: () => void;
}

const WEIGHT_COLORS: Record<string, string> = {
  high: 'border-l-text-primary bg-surface-tertiary',
  medium: 'border-l-text-secondary bg-surface-tertiary',
  low: 'border-l-text-tertiary ',
};

const COMPLETED_COLORS: Record<string, string> = {
  high: 'border-l-text-primary/30 ',
  medium: 'border-l-text-secondary/30 ',
  low: 'border-l-text-tertiary/30 ',
};

const WEIGHT_DOT: Record<string, string> = {
  high: 'bg-text-primary',
  medium: 'bg-text-secondary',
  low: 'bg-text-tertiary',
};

export function TaskCard({
  task,
  clientName,
  isCompleted,
  isCompleting,
  period,
  onDragStart,
  onDragEnd,
  onClick,
  onComplete,
  onUncomplete,
  onUnschedule,
}: TaskCardProps) {
  const weight = task.weight || 'medium';
  const completing = isCompleting || isCompleted;

  return (
    <div
      draggable={!isCompleted}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (!isCompleted) onClick();
      }}
      className={cn(
        'group relative border-l-2 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing transition-all text-xs',
        completing
          ? cn(COMPLETED_COLORS[weight], 'opacity-50')
          : cn(WEIGHT_COLORS[weight], 'hover:brightness-110')
      )}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <div className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <AnimatedCheckbox
            checked={completing}
            onChange={(checked) => checked ? onComplete() : onUncomplete()}
            size="sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', WEIGHT_DOT[weight])} />
            <span
              className={cn(
                'truncate font-medium text-text-primary',
                completing && 'line-through text-text-tertiary'
              )}
            >
              {task.title}
            </span>
            <EnergyMatchIndicator task={task} period={period} />
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2.5 mt-1">
            {clientName && (
              <span className="text-xs text-text-tertiary truncate">{clientName}</span>
            )}
            {task.estimated_minutes && (
              <span className="text-xs text-text-tertiary">{task.estimated_minutes}m</span>
            )}
            {task.is_urgent && (
              <span className="text-xs text-text-primary font-medium">URGENT</span>
            )}
          </div>
        </div>

        {/* Unschedule button */}
        {!isCompleted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule();
            }}
            className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-secondary transition-all text-xs shrink-0 cursor-pointer"
            title="Unschedule"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
