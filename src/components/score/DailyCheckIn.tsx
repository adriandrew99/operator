'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { saveCheckIn } from '@/actions/score';
import { getTodayScore } from '@/actions/score';
import type { CheckInRatings, OperatorScore } from '@/lib/types/database';

interface DailyCheckInProps {
  existingCheckIn: CheckInRatings | null;
  existingNotes: string | null;
  onSaved: (score: OperatorScore) => void;
  variant?: 'standalone' | 'inline';
}

const DIMENSIONS = [
  {
    key: 'focus' as const,
    label: 'Focus & Deep Work',
    low: 'Scattered',
    high: 'Locked in',
  },
  {
    key: 'energy' as const,
    label: 'Energy & Recovery',
    low: 'Drained',
    high: 'Charged',
  },
  {
    key: 'decisions' as const,
    label: 'Decision Making',
    low: 'Hesitant',
    high: 'Decisive',
  },
  {
    key: 'clarity' as const,
    label: 'Clarity & Direction',
    low: 'Foggy',
    high: 'Crystal clear',
  },
  {
    key: 'stress' as const,
    label: 'Stress & Control',
    low: 'Overwhelmed',
    high: 'In control',
  },
];

export function DailyCheckIn({ existingCheckIn, existingNotes, onSaved, variant = 'standalone' }: DailyCheckInProps) {
  const isInline = variant === 'inline';
  const hasExisting = existingCheckIn !== null;
  const [isEditing, setIsEditing] = useState(!hasExisting);
  const [ratings, setRatings] = useState<CheckInRatings>(
    existingCheckIn ?? { focus: 0, energy: 0, decisions: 0, clarity: 0, stress: 0 }
  );
  const [notes, setNotes] = useState(existingNotes ?? '');
  const [showNotes, setShowNotes] = useState(!!existingNotes);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isComplete = ratings.focus > 0 && ratings.energy > 0 && ratings.decisions > 0 && ratings.clarity > 0 && ratings.stress > 0;

  function handleSubmit() {
    if (!isComplete) return;
    startTransition(async () => {
      await saveCheckIn(ratings, notes || undefined);
      const updated = await getTodayScore();
      if (updated) {
        onSaved(updated);
      }
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  // Compact summary when already checked in and not editing
  if (hasExisting && !isEditing) {
    const Wrapper = isInline ? 'div' : 'section';
    return (
      <Wrapper className={isInline ? 'pt-4 border-t border-border' : 'card-elevated rounded-lg p-6'}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={isInline ? 'text-xs font-medium text-text-secondary' : 'text-section-heading text-text-primary'}>
            {isInline ? 'Check-In' : 'Daily Check-In'}
          </h2>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-text-primary animate-fade-in">Saved</span>
            )}
            <span className="text-xs text-text-primary bg-surface-tertiary px-2 py-0.5 rounded-full font-medium">
              Completed
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
            >
              Edit
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {DIMENSIONS.map(dim => (
            <div key={dim.key} className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">{dim.label.split(' ')[0]}:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(v => (
                  <div
                    key={v}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      v <= (existingCheckIn?.[dim.key] ?? 0) ? 'bg-text-primary' : 'bg-surface-tertiary'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-text-secondary">{existingCheckIn?.[dim.key]}/5</span>
            </div>
          ))}
        </div>
        {existingNotes && (
          <p className="text-xs text-text-tertiary mt-2 italic">&ldquo;{existingNotes}&rdquo;</p>
        )}
      </Wrapper>
    );
  }

  return (
    <section className={cn(
      'transition-all',
      isInline
        ? 'pt-4 border-t border-border'
        : cn('rounded-xl p-5 sm:p-6', hasExisting ? 'bg-surface-secondary' : 'bg-surface-secondary border-2 border-border')
    )}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={isInline ? 'text-xs font-medium text-text-secondary' : 'text-section-heading text-text-primary'}>
            {isInline ? 'How did today feel?' : 'Daily Check-In'}
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">Rate your day across five dimensions. Takes 30 seconds.</p>
        </div>
        {hasExisting && (
          <button
            onClick={() => setIsEditing(false)}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-4">
        {DIMENSIONS.map(dim => (
          <div key={dim.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-text-primary font-medium">{dim.label}</span>
              <span className="text-xs text-text-tertiary">
                {ratings[dim.key] > 0 ? `${ratings[dim.key]}/5` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs text-text-tertiary w-14 sm:w-16 text-right flex-shrink-0">{dim.low}</span>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-center">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    onClick={() => setRatings(prev => ({ ...prev, [dim.key]: value }))}
                    className={cn(
                      'w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 transition-all duration-200 cursor-pointer text-xs font-semibold',
                      ratings[dim.key] === value
                        ? 'bg-text-primary border-text-primary text-black scale-110'
                        : ratings[dim.key] > 0 && value <= ratings[dim.key]
                          ? 'bg-surface-tertiary border-text-primary/20 text-text-primary'
                          : 'bg-surface-tertiary border-border text-text-tertiary hover:border-text-primary/20 hover:text-text-secondary'
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <span className="text-xs text-text-tertiary w-14 sm:w-16 flex-shrink-0">{dim.high}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="mt-5">
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            + Add reflection note (optional)
          </button>
        ) : (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Quick reflection on today... (optional)"
            rows={2}
            className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-secondary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors resize-none"
          />
        )}
      </div>

      {/* Submit */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          {isComplete
            ? 'Ready to save your check-in'
            : `Rate all 5 dimensions to continue`}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!isComplete || isPending}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            isComplete
              ? 'bg-text-primary text-background hover:bg-text-primary/90'
              : 'bg-surface-tertiary text-text-tertiary cursor-not-allowed'
          )}
        >
          {isPending ? 'Saving...' : hasExisting ? 'Update' : 'Save Check-In'}
        </button>
      </div>
    </section>
  );
}
