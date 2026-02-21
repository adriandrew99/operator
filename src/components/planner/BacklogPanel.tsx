'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { calculateDailyLoad } from '@/lib/utils/mental-load';
import type { Task, Client } from '@/lib/types/database';

interface BacklogPanelProps {
  tasks: Task[];
  clients: Client[];
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  dragTaskId: string | null;
}

const WEIGHT_DOT: Record<string, string> = {
  high: 'bg-text-primary',
  medium: 'bg-text-secondary',
  low: 'bg-text-tertiary',
};

export function BacklogPanel({
  tasks,
  clients,
  onDragStart,
  onDragEnd,
  dragTaskId,
}: BacklogPanelProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('planner-backlog-collapsed') === 'true';
    }
    return false;
  });

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
  const totalMLU = useMemo(() => calculateDailyLoad(tasks), [tasks]);

  // Group by energy type
  const grouped = useMemo(() => {
    const creative = tasks.filter(t => t.energy === 'creative');
    const admin = tasks.filter(t => t.energy !== 'creative');
    return { creative, admin };
  }, [tasks]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('planner-backlog-collapsed', String(next));
    }
  }

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface-secondary/30">
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary font-medium">
            Backlog
          </span>
          <span className="text-xs text-text-tertiary">
            {tasks.length} tasks · {Math.round(totalMLU)} MLU
          </span>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={cn('text-text-tertiary transition-transform', collapsed ? '' : 'rotate-180')}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="px-4 pb-3">
          {/* Creative tasks */}
          {grouped.creative.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-text-secondary font-medium mb-1">
                Creative ({grouped.creative.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {grouped.creative.map(task => (
                  <BacklogChip
                    key={task.id}
                    task={task}
                    clientName={task.client_id ? clientMap.get(task.client_id) || null : null}
                    isDragging={dragTaskId === task.id}
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Admin tasks */}
          {grouped.admin.length > 0 && (
            <div>
              <div className="text-xs text-text-tertiary/70 font-medium mb-1">
                Admin ({grouped.admin.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {grouped.admin.map(task => (
                  <BacklogChip
                    key={task.id}
                    task={task}
                    clientName={task.client_id ? clientMap.get(task.client_id) || null : null}
                    isDragging={dragTaskId === task.id}
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BacklogChip({
  task,
  clientName,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  clientName: string | null;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const weight = task.weight || 'medium';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-tertiary cursor-grab active:cursor-grabbing transition-all text-xs',
        isDragging && 'opacity-40',
        'hover:brightness-110'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', WEIGHT_DOT[weight])} />
      <span className="text-text-primary truncate max-w-[120px]">{task.title}</span>
      {clientName && <span className="text-xs text-text-tertiary truncate max-w-[60px]">{clientName}</span>}
      {task.is_urgent && <span className="text-xs text-text-primary font-medium">!</span>}
    </div>
  );
}
