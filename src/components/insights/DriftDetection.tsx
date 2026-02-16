'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

interface DriftDetectionProps {
  streakDays: number;
  fundamentals: { id: string; label: string }[];
  completions: Record<string, boolean>;
  todayTasks: { weight: string; status: string }[];
  recentScores: { date: string; score: number }[];
}

type DriftLevel = 'locked-in' | 'slight' | 'drifting' | 'red-alert' | 'emergency';

interface DriftAnalysis {
  score: number;
  level: DriftLevel;
  label: string;
  factors: { name: string; contribution: number; suggestion: string }[];
}

function getDriftLevel(score: number): { level: DriftLevel; label: string } {
  if (score <= 20) return { level: 'locked-in', label: 'Locked In' };
  if (score <= 40) return { level: 'slight', label: 'Slight Drift' };
  if (score <= 60) return { level: 'drifting', label: 'Drifting' };
  if (score <= 80) return { level: 'red-alert', label: 'Red Alert' };
  return { level: 'emergency', label: 'Emergency' };
}

function getDriftColor(level: DriftLevel): string {
  switch (level) {
    case 'locked-in': return 'text-accent';
    case 'slight': return 'text-accent';
    case 'drifting': return 'text-amber-400';
    case 'red-alert': return 'text-red-400';
    case 'emergency': return 'text-red-500';
  }
}

function getMeterGradient(score: number): string {
  if (score <= 20) return 'from-accent to-accent';
  if (score <= 40) return 'from-accent to-amber-400';
  if (score <= 60) return 'from-accent via-amber-400 to-amber-500';
  if (score <= 80) return 'from-accent via-amber-400 to-red-400';
  return 'from-accent via-amber-400 to-red-500';
}

export function DriftDetection({
  streakDays,
  fundamentals,
  completions,
  todayTasks,
  recentScores,
}: DriftDetectionProps) {
  const analysis = useMemo<DriftAnalysis>(() => {
    const factors: { name: string; contribution: number; suggestion: string }[] = [];
    let totalScore = 0;

    // Factor 1: Streak broken (weight 30)
    if (streakDays === 0) {
      totalScore += 30;
      factors.push({
        name: 'Streak Broken',
        contribution: 30,
        suggestion: 'Rebuild your streak today. Complete your fundamentals to get back on track.',
      });
    } else if (streakDays <= 2) {
      const partial = Math.round(30 * (1 - streakDays / 3));
      totalScore += partial;
      factors.push({
        name: 'Streak Fragile',
        contribution: partial,
        suggestion: 'Your streak is young. Protect it by locking in fundamentals early.',
      });
    }

    // Factor 2: Fundamentals < 50% (weight 25)
    const totalFundamentals = fundamentals.length;
    const completedFundamentals = fundamentals.filter((f) => completions[f.id]).length;
    const fundamentalRate = totalFundamentals > 0 ? completedFundamentals / totalFundamentals : 1;
    if (fundamentalRate < 0.5) {
      const severity = Math.round(25 * (1 - fundamentalRate * 2));
      totalScore += severity;
      factors.push({
        name: 'Fundamentals Low',
        contribution: severity,
        suggestion: 'Less than half your fundamentals done. Pick the easiest one and start there.',
      });
    }

    // Factor 3: Low task completion (weight 20)
    const totalTasks = todayTasks.length;
    const completedTaskCount = todayTasks.filter(t => t.status === 'completed').length;
    const taskRate = totalTasks > 0 ? completedTaskCount / totalTasks : 1;
    if (totalTasks > 0 && taskRate < 0.3) {
      const severity = Math.round(20 * (1 - taskRate / 0.3));
      totalScore += severity;
      factors.push({
        name: 'Low Task Completion',
        contribution: severity,
        suggestion: completedTaskCount === 0
          ? 'No tasks completed yet. Pick the easiest one and start.'
          : `Only ${completedTaskCount}/${totalTasks} tasks done. Push to complete more.`,
      });
    }

    // Factor 4: No high-energy tasks completed (weight 15)
    const highTasksCompleted = todayTasks.filter(
      (t) => t.weight === 'high' && t.status === 'completed'
    ).length;
    if (highTasksCompleted === 0) {
      const hasHighTasks = todayTasks.some((t) => t.weight === 'high');
      totalScore += 15;
      factors.push({
        name: 'No High-Impact Tasks Done',
        contribution: 15,
        suggestion: hasHighTasks
          ? 'You have high-energy tasks queued. Attack the most important one next.'
          : 'No high-impact tasks on your list. Add one that moves the needle.',
      });
    }

    // Factor 5: Declining scores over last 3 days (weight 10)
    if (recentScores.length >= 3) {
      const lastThree = recentScores.slice(-3);
      const isDecline = lastThree[2].score < lastThree[1].score && lastThree[1].score < lastThree[0].score;
      if (isDecline) {
        totalScore += 10;
        factors.push({
          name: 'Scores Declining',
          contribution: 10,
          suggestion: 'Three-day downward trend. Today is the day to reverse it.',
        });
      }
    }

    const clampedScore = Math.min(100, Math.max(0, totalScore));
    const { level, label } = getDriftLevel(clampedScore);

    return {
      score: clampedScore,
      level,
      label,
      factors: factors.sort((a, b) => b.contribution - a.contribution),
    };
  }, [streakDays, fundamentals, completions, todayTasks, recentScores]);

  const topSuggestions = analysis.factors.slice(0, 2);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-accent uppercase tracking-widest">
          Drift Detection
        </p>
        <span
          className={cn(
            'text-[9px] px-2 py-0.5 rounded-md font-medium',
            analysis.level === 'locked-in' && 'bg-accent/15 text-accent',
            analysis.level === 'slight' && 'bg-accent/10 text-accent',
            analysis.level === 'drifting' && 'bg-amber-500/15 text-amber-400',
            analysis.level === 'red-alert' && 'bg-red-500/15 text-red-400',
            analysis.level === 'emergency' && 'bg-red-500/20 text-red-500'
          )}
        >
          {analysis.label}
        </span>
      </div>

      {/* Drift Meter */}
      <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Drift Score</span>
          <span
            className={cn('text-lg font-mono font-bold', getDriftColor(analysis.level))}
          >
            {analysis.score}
          </span>
        </div>

        {/* Horizontal drift bar */}
        <div className="w-full h-2.5 bg-surface-tertiary overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r',
              getMeterGradient(analysis.score)
            )}
            style={{ width: `${analysis.score}%` }}
          />
        </div>

        {/* Scale labels */}
        <div className="flex items-center justify-between text-[9px] text-text-tertiary">
          <span>Locked In</span>
          <span>Drifting</span>
          <span>Emergency</span>
        </div>
      </div>

      {/* Factor Breakdown */}
      {analysis.factors.length > 0 && (
        <div className="space-y-1.5">
          {analysis.factors.map((factor) => (
            <div
              key={factor.name}
              className="flex items-center gap-2 text-[11px]"
            >
              <div className="w-16 h-1 bg-surface-tertiary overflow-hidden rounded-full flex-shrink-0">
                <div
                  className={cn(
                    'h-full rounded-full',
                    factor.contribution >= 20 ? 'bg-red-400' :
                    factor.contribution >= 10 ? 'bg-amber-400' :
                    'bg-accent'
                  )}
                  style={{ width: `${(factor.contribution / 30) * 100}%` }}
                />
              </div>
              <span className="text-text-tertiary">{factor.name}</span>
              <span className="text-text-tertiary font-mono ml-auto">+{factor.contribution}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actionable Suggestions */}
      {topSuggestions.length > 0 && (
        <div className="space-y-2">
          {topSuggestions.map((suggestion) => (
            <div
              key={suggestion.name}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-xl text-xs',
                analysis.level === 'locked-in' || analysis.level === 'slight'
                  ? 'bg-surface-tertiary/50 border border-border/50'
                  : analysis.level === 'drifting'
                  ? 'bg-amber-500/5 border border-amber-500/15'
                  : 'bg-red-500/5 border border-red-500/15'
              )}
            >
              <span className="text-base flex-shrink-0 mt-0.5">
                {suggestion.contribution >= 20 ? '!' : '\u2192'}
              </span>
              <p
                className={cn(
                  'leading-relaxed',
                  analysis.level === 'locked-in' || analysis.level === 'slight'
                    ? 'text-text-secondary'
                    : analysis.level === 'drifting'
                    ? 'text-amber-400'
                    : 'text-red-400'
                )}
              >
                {suggestion.suggestion}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
