'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { saveCheckInForDate } from '@/actions/score';
import type { CheckInRatings, ScoreBreakdownV2 } from '@/lib/types/database';

interface RetroactiveCheckInProps {
  scoreHistory: {
    date: string;
    score: number;
    breakdown: ScoreBreakdownV2 | Record<string, number>;
    check_in: CheckInRatings | null;
    version: number;
  }[];
}

const DIMENSIONS = [
  { key: 'focus' as const, label: 'Focus', low: 'Scattered', high: 'Locked in' },
  { key: 'energy' as const, label: 'Energy', low: 'Drained', high: 'Charged' },
  { key: 'decisions' as const, label: 'Decisions', low: 'Hesitant', high: 'Decisive' },
  { key: 'clarity' as const, label: 'Clarity', low: 'Foggy', high: 'Clear' },
  { key: 'stress' as const, label: 'Control', low: 'Overwhelmed', high: 'In control' },
];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function RetroactiveCheckIn({ scoreHistory }: RetroactiveCheckInProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ratings, setRatings] = useState<CheckInRatings>({ focus: 0, energy: 0, decisions: 0, clarity: 0, stress: 0 });
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  // Find days without check-in (last 14 days from history)
  const today = new Date().toISOString().split('T')[0];
  const missedDays = scoreHistory
    .filter(h => h.check_in === null && h.date !== today)
    .map(h => ({ date: h.date, score: h.score }));

  // Also allow check-in for any day in the last 7 days that has no score at all
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i - 1);
    return d.toISOString().split('T')[0];
  });
  const existingDates = new Set(scoreHistory.map(h => h.date));
  const unloggedDays = last7
    .filter(d => !existingDates.has(d))
    .map(d => ({ date: d, score: null }));

  const allMissedDays = [...missedDays, ...unloggedDays]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  // Nothing to show
  if (allMissedDays.length === 0 && !saved) return null;

  const isComplete = ratings.focus > 0 && ratings.energy > 0 && ratings.decisions > 0 && ratings.clarity > 0 && ratings.stress > 0;

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setRatings({ focus: 0, energy: 0, decisions: 0, clarity: 0, stress: 0 });
    setNotes('');
    setIsExpanded(true);
  }

  function handleSubmit() {
    if (!selectedDate || !isComplete) return;
    startTransition(async () => {
      await saveCheckInForDate(selectedDate, ratings, notes || undefined);
      setSaved(selectedDate);
      setSelectedDate(null);
      setRatings({ focus: 0, energy: 0, decisions: 0, clarity: 0, stress: 0 });
      setNotes('');
      setTimeout(() => setSaved(null), 3000);
    });
  }

  return (
    <section className="card-elevated rounded-lg p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-section-heading text-text-primary">Backfill Check-Ins</h2>
          {allMissedDays.length > 0 && (
            <span className="text-xs bg-surface-tertiary text-text-secondary px-2 py-0.5 rounded-full font-medium">
              {allMissedDays.length} missed
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <p className="text-xs text-text-tertiary mb-4">
        Forgot to log? Rate past days to fill in your score history.
      </p>

      {saved && (
        <div className="bg-accent-green/10 border border-accent-green/20 rounded-xl px-4 py-2.5 mb-4 text-xs text-accent-green animate-fade-in">
          Check-in saved for {formatDateLabel(saved)}. Score updated.
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4 animate-fade-in">
          {/* Day selector */}
          <div className="flex gap-2 flex-wrap">
            {allMissedDays.map(day => (
              <button
                key={day.date}
                onClick={() => handleSelectDate(day.date)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer',
                  selectedDate === day.date
                    ? 'bg-surface-tertiary text-text-primary border-text-primary/20'
                    : 'bg-surface-secondary text-text-secondary border-border hover:border-border-light hover:text-text-primary'
                )}
              >
                <span className="block">{formatDateLabel(day.date)}</span>
                {day.score !== null && (
                  <span className="block text-text-tertiary mt-0.5">Score: {day.score}</span>
                )}
                {day.score === null && (
                  <span className="block text-text-tertiary mt-0.5">No data</span>
                )}
              </button>
            ))}
          </div>

          {/* Check-in form for selected date */}
          {selectedDate && (
            <div className="bg-surface-secondary rounded-xl p-4 space-y-4 border border-border animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">
                  Check-in for {formatDateLabel(selectedDate)}
                </p>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                {DIMENSIONS.map(dim => (
                  <div key={dim.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary font-medium">{dim.label}</span>
                      <span className="text-xs text-text-tertiary">
                        {ratings[dim.key] > 0 ? `${ratings[dim.key]}/5` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-tertiary w-16 text-right flex-shrink-0">{dim.low}</span>
                      <div className="flex items-center gap-1.5 flex-1 justify-center">
                        {[1, 2, 3, 4, 5].map(value => (
                          <button
                            key={value}
                            onClick={() => setRatings(prev => ({ ...prev, [dim.key]: value }))}
                            className={cn(
                              'w-8 h-8 rounded-full border-2 transition-all duration-200 cursor-pointer text-xs font-semibold',
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
                      <span className="text-xs text-text-tertiary w-16 flex-shrink-0">{dim.high}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optional notes */}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Quick reflection on this day... (optional)"
                rows={2}
                className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-secondary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors resize-none"
              />

              {/* Submit */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-tertiary">
                  {isComplete ? 'Ready to save' : 'Rate all 5 dimensions'}
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
                  {isPending ? 'Saving...' : 'Save Check-In'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isExpanded && allMissedDays.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {allMissedDays.slice(0, 7).map(day => (
            <span
              key={day.date}
              className="text-xs bg-surface-tertiary text-text-tertiary px-2 py-1 rounded-lg"
            >
              {formatDateLabel(day.date)}
            </span>
          ))}
          {allMissedDays.length > 7 && (
            <span className="text-xs text-text-tertiary px-2 py-1">
              +{allMissedDays.length - 7} more
            </span>
          )}
        </div>
      )}
    </section>
  );
}
