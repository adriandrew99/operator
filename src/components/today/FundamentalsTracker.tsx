'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { AnimatedCheckbox } from '@/components/ui/AnimatedCheckbox';
import { toggleFundamentalCompletion } from '@/actions/fundamentals';
import type { CustomFundamental } from '@/lib/types/database';

interface FundamentalsTrackerProps {
  fundamentals: CustomFundamental[];
  completions: Record<string, boolean>;
}

export function FundamentalsTracker({ fundamentals, completions }: FundamentalsTrackerProps) {
  const [state, setState] = useState<Record<string, boolean>>(completions);

  function handleToggle(fundamentalId: string, newValue: boolean) {
    const nextState = { ...state, [fundamentalId]: newValue };
    setState(nextState);
    toggleFundamentalCompletion(fundamentalId, newValue).catch(e => console.error(e));
  }

  const hitCount = fundamentals.filter((f) => state[f.id]).length;
  const progressPct = fundamentals.length > 0 ? (hitCount / fundamentals.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {fundamentals.length === 0 ? (
        <p className="text-xs text-text-tertiary py-3">
          No fundamentals configured. Add them in Settings.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fundamentals.map((fundamental) => {
            const checked = state[fundamental.id] ?? false;
            return (
              <div
                key={fundamental.id}
                className={cn(
                  'flex items-center gap-3 py-3 px-3.5 rounded-xl transition-colors duration-150',
                  checked
                    ? 'bg-surface-tertiary'
                    : 'hover:bg-surface-tertiary/60'
                )}
              >
                <AnimatedCheckbox
                  checked={checked}
                  onChange={(val) => handleToggle(fundamental.id, val)}
                  size="sm"
                />
                <span className="text-base flex-shrink-0">{fundamental.icon}</span>
                <span
                  className={cn(
                    'text-xs transition-colors',
                    checked ? 'text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {fundamental.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
