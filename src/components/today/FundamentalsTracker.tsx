'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { toggleFundamentalCompletion } from '@/actions/fundamentals';
import type { CustomFundamental } from '@/lib/types/database';

interface FundamentalsTrackerProps {
  fundamentals: CustomFundamental[];
  completions: Record<string, boolean>;
}

export function FundamentalsTracker({ fundamentals, completions }: FundamentalsTrackerProps) {
  const [state, setState] = useState<Record<string, boolean>>(completions);

  function handleToggle(fundamentalId: string) {
    const currentValue = state[fundamentalId] ?? false;
    const newValue = !currentValue;

    // Optimistic update
    setState((prev) => ({ ...prev, [fundamentalId]: newValue }));

    // Fire-and-forget
    toggleFundamentalCompletion(fundamentalId, newValue).catch(e => console.error(e));
  }

  const hitCount = fundamentals.filter((f) => state[f.id]).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
          Fundamentals
        </p>
        <p className="text-[10px] text-text-tertiary">
          {hitCount}/{fundamentals.length}
        </p>
      </div>

      {fundamentals.length === 0 ? (
        <p className="text-xs text-text-tertiary py-3">
          No fundamentals configured. Add them in Settings.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {fundamentals.map((fundamental) => {
            const checked = state[fundamental.id] ?? false;
            return (
              <button
                key={fundamental.id}
                onClick={() => handleToggle(fundamental.id)}
                disabled={false}
                className={cn(
                  'flex items-center gap-2.5 py-3 px-3.5 rounded-xl transition-all duration-200 text-left',
                  'hover:bg-surface-tertiary/60',
                  checked && 'bg-accent/8'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-all duration-200',
                    checked
                      ? 'bg-accent border-accent shadow-sm shadow-accent/30'
                      : 'border-border-light'
                  )}
                >
                  {checked && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-base flex-shrink-0">{fundamental.icon}</span>
                <span
                  className={cn(
                    'text-xs transition-colors',
                    checked ? 'text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {fundamental.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
