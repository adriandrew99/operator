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
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-accent',
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
    <div className="rounded-xl border border-border/50 bg-surface-secondary/30">
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
            Backlog
          </span>
          <span className="text-[9px] text-text-tertiary">
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
              <div className="text-[9px] uppercase tracking-wider text-purple-400/70 font-medium mb-1">
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
              <div className="text-[9px] uppercase tracking-wider text-text-tertiary/70 font-medium mb-1">
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
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/40 bg-surface-secondary cursor-grab active:cursor-grabbing transition-all text-[11px]',
        isDragging && 'opacity-40',
        'hover:border-border/60 hover:bg-surface-tertiary'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', WEIGHT_DOT[weight])} />
      <span className="text-text-primary truncate max-w-[120px]">{task.title}</span>
      {clientName && <span className="text-[9px] text-text-tertiary truncate max-w-[60px]">{clientName}</span>}
      {task.is_urgent && <span className="text-[8px] text-red-400 font-medium">!</span>}
    </div>
  );
}
