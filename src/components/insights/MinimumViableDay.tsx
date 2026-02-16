'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { InfoBox } from '@/components/ui/InfoBox';
import { completeTask } from '@/actions/tasks';

interface MinimumViableDayProps {
  fundamentals: { id: string; label: string }[];
  completions: Record<string, boolean>;
  todayTasks: { id: string; title: string; weight: string; status: string }[];
  streakDays: number;
  onCompleteFundamental?: (id: string) => void;
}

interface MVDCriterion {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

interface StretchGoal {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export function MinimumViableDay({
  fundamentals,
  completions,
  todayTasks,
  streakDays,
  onCompleteFundamental,
}: MinimumViableDayProps) {
  const [isPending, setIsPending] = useState(false);
  const [quickWinOpen, setQuickWinOpen] = useState(false);

  const analysis = useMemo(() => {
    const completedFundamentals = fundamentals.filter((f) => completions[f.id]).length;
    const completedTasks = todayTasks.filter((t) => t.status === 'completed');
    const incompleteTasks = todayTasks.filter((t) => t.status !== 'completed');
    const completedHighTasks = completedTasks.filter((t) => t.weight === 'high');

    // MVD Criteria
    const criteria: MVDCriterion[] = [
      {
        id: 'fundamental',
        label: 'At least 1 fundamental done',
        met: completedFundamentals >= 1,
        detail: completedFundamentals >= 1
          ? `${completedFundamentals} completed`
          : 'None completed yet',
      },
      {
        id: 'task',
        label: 'At least 1 task completed',
        met: completedTasks.length >= 1,
        detail: completedTasks.length >= 1
          ? `${completedTasks.length} completed`
          : 'No tasks completed',
      },
      {
        id: 'streak',
        label: 'Maintain streak',
        met: streakDays >= 1,
        detail: streakDays >= 1
          ? `${streakDays}d streak`
          : 'No streak yet',
      },
    ];

    const mvdMet = criteria.every((c) => c.met);
    const mvdProgress = criteria.filter((c) => c.met).length;

    // Stretch Goals
    const stretchGoals: StretchGoal[] = [
      {
        id: 'fundamentals-3',
        label: 'Complete 3+ fundamentals',
        met: completedFundamentals >= 3,
        detail: `${completedFundamentals} done`,
      },
      {
        id: 'streak-3',
        label: '3+ day streak',
        met: streakDays >= 3,
        detail: `${streakDays}d streak`,
      },
      {
        id: 'high-task',
        label: 'Complete 1 high-energy task',
        met: completedHighTasks.length >= 1,
        detail: completedHighTasks.length >= 1
          ? `${completedHighTasks.length} completed`
          : 'None yet',
      },
    ];

    const stretchMet = stretchGoals.filter((g) => g.met).length;

    // Status message
    let statusMessage: string;
    if (mvdMet && stretchMet === stretchGoals.length) {
      statusMessage = 'Exceptional day. You went beyond the minimum and crushed your stretch goals.';
    } else if (mvdMet && stretchMet > 0) {
      statusMessage = 'MVD achieved and stretch goals in progress. Keep pushing.';
    } else if (mvdMet) {
      statusMessage = 'Minimum Viable Day locked in. The foundation is set \u2014 stretch goals are bonus.';
    } else if (mvdProgress >= 2) {
      statusMessage = 'Almost there. One more criterion and your MVD is secured.';
    } else if (mvdProgress >= 1) {
      statusMessage = 'Progress started. Keep going \u2014 MVD is within reach today.';
    } else {
      statusMessage = 'Day not started yet. The MVD bar is low on purpose \u2014 just begin.';
    }

    // First incomplete task for quick win
    const firstIncompleteTask = incompleteTasks.length > 0 ? incompleteTasks[0] : null;

    return {
      criteria,
      mvdMet,
      mvdProgress,
      stretchGoals,
      stretchMet,
      statusMessage,
      firstIncompleteTask,
      incompleteTasks,
    };
  }, [fundamentals, completions, todayTasks, streakDays]);

  function handleFundamentalClick() {
    // Scroll to the fundamentals section on the page
    const fundamentalsSection = document.getElementById('fundamentals-section');
    if (fundamentalsSection) {
      fundamentalsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleQuickComplete(taskId: string) {
    setIsPending(true);
    setQuickWinOpen(false);
    completeTask(taskId)
      .catch(e => console.error(e))
      .finally(() => setIsPending(false));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-accent uppercase tracking-widest">
          Minimum Viable Day
        </p>
        <InfoBox title="Minimum Viable Day">
          <p>
            The MVD prevents all-or-nothing days. Hit these 3 low bars and your day counts.
            Stretch goals are bonus.
          </p>
        </InfoBox>
        {analysis.mvdMet ? (
          <span className="text-[9px] px-2 py-0.5 rounded-md font-medium bg-accent/15 text-accent">
            MVD Achieved
          </span>
        ) : (
          <span className="text-[9px] px-2 py-0.5 rounded-md font-medium bg-surface-tertiary text-text-tertiary">
            {analysis.mvdProgress}/{analysis.criteria.length}
          </span>
        )}
      </div>

      {/* MVD Checklist */}
      <div
        className={cn(
          'rounded-xl border p-4 space-y-2.5 transition-all duration-500',
          analysis.mvdMet
            ? 'bg-accent/5 border-accent/30 shadow-[0_0_15px_-3px] shadow-accent/10'
            : 'bg-surface-tertiary/40 border-border/50'
        )}
      >
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-2">
          Core Protocol
        </p>

        {analysis.criteria.map((criterion) => (
          <div key={criterion.id} className="flex items-center gap-3">
            {/* Checkbox / interactive area */}
            {criterion.id === 'fundamental' ? (
              <button
                type="button"
                onClick={handleFundamentalClick}
                className={cn(
                  'w-5 h-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110',
                  criterion.met
                    ? 'bg-accent border-accent shadow-sm shadow-accent/30'
                    : 'border-border hover:border-accent/50'
                )}
                title="Go to fundamentals"
              >
                {criterion.met ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="black"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-[8px] text-text-tertiary">{'\u2715'}</span>
                )}
              </button>
            ) : (
              <div
                className={cn(
                  'w-5 h-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-all duration-200',
                  criterion.met
                    ? 'bg-accent border-accent shadow-sm shadow-accent/30'
                    : 'border-border'
                )}
              >
                {criterion.met ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="black"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-[8px] text-text-tertiary">{'\u2715'}</span>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  'text-xs',
                  criterion.met ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {criterion.label}
              </span>
            </div>

            <span
              className={cn(
                'text-[10px] font-mono flex-shrink-0',
                criterion.met ? 'text-accent' : 'text-text-tertiary'
              )}
            >
              {criterion.detail}
            </span>

            {/* Quick Win button for task criterion */}
            {criterion.id === 'task' && !criterion.met && analysis.firstIncompleteTask && (
              <button
                type="button"
                onClick={() => setQuickWinOpen(!quickWinOpen)}
                className="text-[9px] px-2 py-0.5 rounded-md font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors flex-shrink-0"
              >
                Quick Win
              </button>
            )}
          </div>
        ))}

        {/* Quick Win expanded panel */}
        {quickWinOpen && analysis.firstIncompleteTask && (
          <div className="mt-2 p-3 rounded-lg bg-surface-secondary/60 border border-accent/20 space-y-2 animate-fade-in">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
              First incomplete task
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-primary truncate flex-1">
                {analysis.firstIncompleteTask.title}
              </span>
              <button
                type="button"
                onClick={() => handleQuickComplete(analysis.firstIncompleteTask!.id)}
                disabled={isPending}
                className={cn(
                  'text-[10px] px-3 py-1 rounded-lg font-medium transition-all flex-shrink-0',
                  isPending
                    ? 'bg-surface-tertiary text-text-tertiary cursor-wait'
                    : 'bg-accent text-black hover:bg-accent/90 active:scale-95'
                )}
              >
                {isPending ? 'Completing...' : 'Complete'}
              </button>
            </div>
            {analysis.firstIncompleteTask.weight === 'high' && (
              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                High energy
              </span>
            )}
          </div>
        )}

        {/* Status message */}
        <div
          className={cn(
            'mt-3 pt-3 border-t',
            analysis.mvdMet ? 'border-accent/15' : 'border-border/30'
          )}
        >
          <p
            className={cn(
              'text-[11px] leading-relaxed',
              analysis.mvdMet ? 'text-accent' : 'text-text-secondary'
            )}
          >
            {analysis.statusMessage}
          </p>
        </div>
      </div>

      {/* Stretch Goals */}
      <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
            Stretch Goals
          </p>
          {analysis.stretchMet > 0 && (
            <span className="text-[9px] font-mono text-accent">
              {analysis.stretchMet}/{analysis.stretchGoals.length}
            </span>
          )}
        </div>
        {analysis.stretchGoals.map((goal) => (
          <div key={goal.id} className="flex items-center gap-3">
            <div
              className={cn(
                'w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center',
                goal.met
                  ? 'bg-accent-blue border-accent-blue'
                  : 'border-border/60'
              )}
            >
              {goal.met && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6L5 9L10 3"
                    stroke="black"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span
              className={cn(
                'text-[11px] flex-1',
                goal.met ? 'text-text-primary' : 'text-text-tertiary'
              )}
            >
              {goal.label}
            </span>
            <span
              className={cn(
                'text-[10px] font-mono',
                goal.met ? 'text-accent-blue' : 'text-text-tertiary'
              )}
            >
              {goal.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
