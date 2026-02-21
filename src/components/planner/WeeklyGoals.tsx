'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { AnimatedCheckbox } from '@/components/ui/AnimatedCheckbox';
import { upsertWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal } from '@/actions/planner';
import type { WeeklyGoal } from '@/lib/types/database';

interface WeeklyGoalsProps {
  goals: WeeklyGoal[];
  weekStart: string;
}

const MAX_GOALS = 3;

export function WeeklyGoals({ goals, weekStart }: WeeklyGoalsProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('planner-goals-collapsed') === 'true';
    }
    return false;
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('planner-goals-collapsed', String(next));
    }
  }

  function startEditing(index: number, currentTitle: string) {
    setEditingIndex(index);
    setEditValue(currentTitle);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function saveGoal(index: number) {
    const title = editValue.trim();
    if (!title) {
      setEditingIndex(null);
      return;
    }
    setEditingIndex(null);
    await upsertWeeklyGoal(weekStart, title, index);
  }

  async function handleToggle(goal: WeeklyGoal) {
    await toggleWeeklyGoal(goal.id, !goal.completed);
  }

  async function handleDelete(goalId: string) {
    await deleteWeeklyGoal(goalId);
  }

  // Pad goals to MAX_GOALS slots
  const slots = Array.from({ length: MAX_GOALS }, (_, i) => goals.find(g => g.sort_order === i) || null);

  const completedCount = goals.filter(g => g.completed).length;
  const totalCount = goals.length;

  return (
    <div className="rounded-2xl border border-border bg-surface-secondary/30">
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary font-medium">
            Week Goals
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-text-tertiary">
              {completedCount}/{totalCount}
            </span>
          )}
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
        <div className="px-4 pb-4 space-y-2">
          {slots.map((goal, index) => (
            <div key={index} className="flex items-center gap-2 group">
              {goal ? (
                <>
                  <AnimatedCheckbox
                    checked={goal.completed}
                    onChange={() => handleToggle(goal)}
                    size="sm"
                  />
                  {editingIndex === index ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveGoal(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveGoal(index);
                        if (e.key === 'Escape') setEditingIndex(null);
                      }}
                      className="flex-1 text-sm bg-transparent text-text-primary outline-none border-b border-border-light"
                    />
                  ) : (
                    <span
                      onClick={() => startEditing(index, goal.title)}
                      className={cn(
                        'flex-1 text-sm cursor-text',
                        goal.completed ? 'line-through text-text-tertiary' : 'text-text-primary'
                      )}
                    >
                      {goal.title}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger text-xs transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <div
                  onClick={() => startEditing(index, '')}
                  className="flex items-center gap-2 w-full cursor-text"
                >
                  <div className="w-4 h-4 rounded border border-border shrink-0" />
                  {editingIndex === index ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveGoal(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveGoal(index);
                        if (e.key === 'Escape') setEditingIndex(null);
                      }}
                      placeholder="Add a goal for this week..."
                      className="flex-1 text-sm bg-transparent text-text-primary outline-none border-b border-border-light placeholder:text-text-tertiary/40"
                    />
                  ) : (
                    <span className="text-sm text-text-tertiary/30">
                      + Add goal
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
