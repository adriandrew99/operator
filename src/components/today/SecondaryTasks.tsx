'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { updateDailyObjective } from '@/actions/today';
import { MAX_SECONDARY_TASKS } from '@/lib/constants';

interface SecondaryTasksProps {
  tasks: {
    text: string | null;
    completed: boolean;
    textField: string;
    completedField: string;
  }[];
}

export function SecondaryTasks({ tasks }: SecondaryTasksProps) {
  const [items, setItems] = useState(tasks);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showLimitMessage, setShowLimitMessage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingIndex]);

  const filledCount = items.filter((t) => t.text).length;

  function handleSave(index: number, value: string) {
    setEditingIndex(null);
    const item = items[index];
    if (value !== item.text) {
      const updated = [...items];
      updated[index] = { ...item, text: value };
      setItems(updated);
      updateDailyObjective(item.textField, value).catch(e => console.error(e));
    }
  }

  function handleToggle(index: number) {
    const item = items[index];
    const newVal = !item.completed;
    const updated = [...items];
    updated[index] = { ...item, completed: newVal };
    setItems(updated);
    updateDailyObjective(item.completedField, newVal).catch(e => console.error(e));
  }

  function handleRemove(index: number) {
    const item = items[index];
    const updated = [...items];
    updated[index] = { ...item, text: null, completed: false };
    setItems(updated);
    Promise.all([
      updateDailyObjective(item.textField, ''),
      updateDailyObjective(item.completedField, false),
    ]).catch(e => console.error(e));
    setShowLimitMessage(false);
  }

  function handleAdd(index: number) {
    if (filledCount >= MAX_SECONDARY_TASKS) {
      setShowLimitMessage(true);
      setTimeout(() => setShowLimitMessage(false), 3000);
      return;
    }
    setEditingIndex(index);
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
        Secondary Tasks
      </p>

      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 group">
            {item.text ? (
              <>
                <button
                  onClick={() => handleToggle(i)}
                  className={cn(
                    'w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-all',
                    item.completed
                      ? 'bg-accent border-accent'
                      : 'border-border-light hover:border-text-secondary'
                  )}
                >
                  {item.completed && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="2" strokeLinecap="square" />
                    </svg>
                  )}
                </button>

                {editingIndex === i ? (
                  <input
                    ref={inputRef}
                    defaultValue={item.text}
                    onBlur={(e) => handleSave(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(i, (e.target as HTMLInputElement).value);
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    className="flex-1 bg-transparent text-sm text-text-primary border-b border-accent pb-0.5 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingIndex(i)}
                    className={cn(
                      'flex-1 text-left text-sm transition-colors',
                      item.completed ? 'text-text-tertiary line-through' : 'text-text-secondary'
                    )}
                  >
                    {item.text}
                  </button>
                )}

                <button
                  onClick={() => handleRemove(i)}
                  className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                </button>
              </>
            ) : editingIndex === i ? (
              <>
                <div className="w-4 h-4 border border-border-light flex-shrink-0" />
                <input
                  ref={inputRef}
                  onBlur={(e) => handleSave(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(i, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditingIndex(null);
                  }}
                  placeholder="Add a task..."
                  className="flex-1 bg-transparent text-sm text-text-primary border-b border-accent pb-0.5 focus:outline-none placeholder:text-text-tertiary"
                />
              </>
            ) : (
              <button
                onClick={() => handleAdd(i)}
                className="flex items-center gap-3 text-text-tertiary hover:text-text-secondary transition-colors text-sm"
              >
                <div className="w-4 h-4 border border-dashed border-border-light flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M4 0V8M0 4H8" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </div>
                Add task
              </button>
            )}
          </div>
        ))}
      </div>

      {showLimitMessage && (
        <p className="text-xs text-warning animate-fade-in">
          Focus wins. Remove something first.
        </p>
      )}
    </div>
  );
}
