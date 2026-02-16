'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import type { CustomFundamental, Task } from '@/lib/types/database';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';

interface HabitInsightsProps {
  fundamentals: CustomFundamental[];
  completions: Record<string, boolean>;
  recurringTasks: RecurringTaskWithStatus[];
  todayTasks: Task[];
  streakDays: number;
}

interface Insight {
  id: string;
  type: 'suggestion' | 'warning' | 'celebration';
  icon: string;
  message: string;
  priority: number;
}

export function HabitInsights({
  fundamentals,
  completions,
  recurringTasks,
  todayTasks,
  streakDays,
}: HabitInsightsProps) {
  const insights = useMemo(() => {
    const results: Insight[] = [];

    // --- Streak Analysis ---
    if (streakDays >= 7) {
      results.push({
        id: 'streak-strong',
        type: 'celebration',
        icon: '🔥',
        message: `${streakDays}-day streak! You're building serious momentum. Keep protecting this.`,
        priority: 1,
      });
    } else if (streakDays === 0) {
      results.push({
        id: 'streak-broken',
        type: 'suggestion',
        icon: '🎯',
        message: 'Start a new streak today. Focus on completing fundamentals first — they compound.',
        priority: 2,
      });
    }

    // --- Fundamental Completion Pattern ---
    const completedCount = fundamentals.filter(f => completions[f.id]).length;
    const totalFundamentals = fundamentals.length;
    const completionRate = totalFundamentals > 0 ? completedCount / totalFundamentals : 0;

    if (completionRate === 1 && totalFundamentals > 0) {
      results.push({
        id: 'fundamentals-perfect',
        type: 'celebration',
        icon: '✅',
        message: 'All fundamentals hit today. Days like this build the operator you want to become.',
        priority: 1,
      });
    } else if (completionRate < 0.5 && totalFundamentals > 3) {
      results.push({
        id: 'fundamentals-low',
        type: 'warning',
        icon: '⚡',
        message: 'Less than half your fundamentals done. Pick the one that gives you the most energy and do it now.',
        priority: 3,
      });
    }

    // --- Task Load Analysis ---
    const intensiveTasks = todayTasks.filter(t => t.weight === 'high');
    if (intensiveTasks.length >= 3) {
      results.push({
        id: 'overloaded',
        type: 'warning',
        icon: '⚠️',
        message: `${intensiveTasks.length} high-energy tasks today. Consider moving 1-2 to tomorrow — sustained output beats burnout.`,
        priority: 3,
      });
    }

    if (todayTasks.length === 0) {
      results.push({
        id: 'no-tasks',
        type: 'suggestion',
        icon: '📋',
        message: 'No tasks flagged for today. Go to Tasks and star what matters most — clarity drives execution.',
        priority: 5,
      });
    }

    // --- Recurring Task Compliance ---
    const completedRecurring = recurringTasks.filter(t => t.completedToday).length;
    const totalRecurring = recurringTasks.length;
    if (totalRecurring > 0 && completedRecurring === totalRecurring) {
      results.push({
        id: 'routines-perfect',
        type: 'celebration',
        icon: '🔄',
        message: 'All daily routines complete. Consistency is your unfair advantage.',
        priority: 3,
      });
    } else if (totalRecurring > 0 && completedRecurring === 0) {
      results.push({
        id: 'routines-none',
        type: 'suggestion',
        icon: '🔄',
        message: 'No routines done yet. Start with the smallest one — momentum builds from action.',
        priority: 4,
      });
    }

    // --- Time-of-day suggestions ---
    const hour = new Date().getHours();
    if (hour >= 21 && completedCount < totalFundamentals) {
      results.push({
        id: 'evening-wrap',
        type: 'suggestion',
        icon: '🌙',
        message: 'End of day approaching. Review what you accomplished and prep tomorrow\'s focus.',
        priority: 5,
      });
    }
    if (hour >= 6 && hour <= 8) {
      results.push({
        id: 'morning-window',
        type: 'suggestion',
        icon: '☀️',
        message: 'Morning golden hours. Your brain is fresh — tackle your hardest task before distractions.',
        priority: 1,
      });
    }

    return results.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [fundamentals, completions, recurringTasks, todayTasks, streakDays]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-accent uppercase tracking-widest">
          AI Insights
        </p>
        <span className="text-[9px] text-text-tertiary px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">
          Smart
        </span>
      </div>
      <div className="space-y-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-xl text-xs transition-all',
              insight.type === 'celebration' && 'bg-accent/5 border border-accent/15',
              insight.type === 'suggestion' && 'bg-surface-tertiary/50 border border-border/50',
              insight.type === 'warning' && 'bg-warning/5 border border-warning/15'
            )}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
            <p className={cn(
              'leading-relaxed',
              insight.type === 'celebration' ? 'text-accent' :
              insight.type === 'warning' ? 'text-warning' :
              'text-text-secondary'
            )}>
              {insight.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
