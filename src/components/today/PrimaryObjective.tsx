'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { updateDailyObjective } from '@/actions/today';

interface PrimaryObjectiveProps {
  objective: string | null;
  completed: boolean;
}

export function PrimaryObjective({ objective, completed }: PrimaryObjectiveProps) {
  const [text, setText] = useState(objective || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(completed);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  function handleSave() {
    setIsEditing(false);
    if (text !== objective) {
      updateDailyObjective('primary_objective', text).catch(e => console.error(e));
    }
  }

  function handleToggle() {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    updateDailyObjective('primary_completed', newVal).catch(e => console.error(e));
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
        Primary Objective
      </p>
      <div className="flex items-start gap-3">
        <button
          onClick={handleToggle}
          className={cn(
            'mt-1 w-5 h-5 border-2 flex-shrink-0 flex items-center justify-center transition-all',
            isCompleted
              ? 'bg-accent border-accent'
              : 'border-border-light hover:border-text-secondary'
          )}
        >
          {isCompleted && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="2" strokeLinecap="square" />
            </svg>
          )}
        </button>

        {isEditing ? (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setText(objective || '');
                setIsEditing(false);
              }
            }}
            placeholder="What is your primary objective today?"
            className={cn(
              'flex-1 bg-transparent text-lg font-semibold text-text-primary',
              'placeholder:text-text-tertiary border-b border-accent pb-1',
              'focus:outline-none'
            )}
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className={cn(
              'flex-1 text-left text-lg font-semibold transition-colors',
              isCompleted
                ? 'text-text-tertiary line-through'
                : text
                  ? 'text-text-primary'
                  : 'text-text-tertiary'
            )}
          >
            {text || 'Set your primary objective...'}
          </button>
        )}
      </div>
    </div>
  );
}
