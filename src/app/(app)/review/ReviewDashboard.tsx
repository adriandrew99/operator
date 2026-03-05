'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { updateWeeklyReview } from '@/actions/review';
import { formatDate } from '@/lib/utils/date';
import type { WeeklyReview, OperatorScore } from '@/lib/types/database';

interface ReviewDashboardProps {
  review: WeeklyReview | null;
  scores: Pick<OperatorScore, 'date' | 'score'>[];
  history: WeeklyReview[];
}

const PROMPTS = [
  { field: 'revenue_reflection', question: 'What did you earn this week?', icon: '£' },
  { field: 'deep_work_reflection', question: 'What was your most focused work this week?', icon: '◎' },
  { field: 'training_reflection', question: 'Did you train consistently?', icon: '▲' },
  { field: 'drift_reflection', question: 'Where did you drift from the plan?', icon: '◇' },
  { field: 'time_waste_reflection', question: 'What was your biggest time waste?', icon: '⊗' },
  { field: 'meaning_reflection', question: 'What gave you the most meaning?', icon: '◈' },
];

export function ReviewDashboard({ review, scores, history }: ReviewDashboardProps) {
  const [localReview, setLocalReview] = useState(review);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleFieldChange = useCallback((field: string, value: string) => {
    setLocalReview((prev) => prev ? { ...prev, [field]: value } : null);

    if (debounceRef.current[field]) {
      clearTimeout(debounceRef.current[field]);
    }

    debounceRef.current[field] = setTimeout(() => {
      updateWeeklyReview(field, value);
    }, 800);
  }, []);

  // Build weekly score averages for trend chart
  const weeklyScores: { week: string; avg: number }[] = [];
  if (scores.length > 0) {
    const byWeek: Record<string, number[]> = {};
    scores.forEach((s) => {
      const d = new Date(s.date + 'T00:00:00');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d);
      weekStart.setDate(diff);
      const key = weekStart.toISOString().split('T')[0];
      if (!byWeek[key]) byWeek[key] = [];
      byWeek[key].push(s.score);
    });
    Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([week, weekScores]) => {
        const avg = Math.round(weekScores.reduce((s, v) => s + v, 0) / weekScores.length);
        weeklyScores.push({ week, avg });
      });
  }

  const maxScore = Math.max(...weeklyScores.map((w) => w.avg), 100);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Weekly Review</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Reflect on the week and set intentions for the next</p>
      </div>

      {/* Reflection Prompts */}
      <div className="space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          Reflection Prompts
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMPTS.map((prompt) => (
            <div key={prompt.field} className="card-elevated rounded-lg p-5 space-y-3 hover:border-border-light transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                  <span className="text-text-secondary text-xs">{prompt.icon}</span>
                </div>
                <p className="text-xs font-medium text-text-secondary">{prompt.question}</p>
              </div>
              <textarea
                value={(localReview?.[prompt.field as keyof WeeklyReview] as string) || ''}
                onChange={(e) => handleFieldChange(prompt.field, e.target.value)}
                placeholder="Write your reflection..."
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary/50 resize-none focus:outline-none min-h-[60px] leading-relaxed"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Trend Chart */}
      {weeklyScores.length > 1 && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
            Operator Score Trend
          </p>
          <div className="card-elevated rounded-lg p-6">
            <div className="h-36 flex items-end gap-2">
              {weeklyScores.slice(-8).map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-medium tabular-nums text-text-secondary">{w.avg}</span>
                  <div
                    className={cn(
                      'w-full rounded-sm transition-all duration-500',
                      w.avg >= 70 ? 'bg-accent/60' : w.avg >= 40 ? 'bg-text-secondary/40' : 'bg-text-tertiary/30'
                    )}
                    style={{ height: `${(w.avg / maxScore) * 100}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-text-tertiary">{formatDate(w.week)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Focus Areas */}
      <div className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          Focus Areas for Next Week
        </p>
        <div className="card-elevated rounded-lg p-5 space-y-2.5">
          {['focus_area_1', 'focus_area_2', 'focus_area_3'].map((field, i) => (
            <div key={field} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg bg-surface-tertiary flex items-center justify-center text-xs text-text-tertiary font-mono flex-shrink-0">{i + 1}</span>
              <input
                value={(localReview?.[field as keyof WeeklyReview] as string) || ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                placeholder={`Focus area ${i + 1}...`}
                className="flex-1 bg-transparent border-b border-border px-1 py-2 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-accent/30 transition-colors outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Review History */}
      {history.length > 1 && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
            Past Reviews
          </p>
          <div className="card-elevated rounded-lg overflow-hidden divide-y divide-border">
            {history.slice(1).map((r) => (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-surface-tertiary/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-text-primary">Week of {formatDate(r.week_start)}</p>
                  {r.total_operator_score_avg != null && (
                    <span className="text-xs text-text-tertiary mt-0.5">Score: {r.total_operator_score_avg}</span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap max-w-48">
                  {[r.focus_area_1, r.focus_area_2, r.focus_area_3].filter(Boolean).map((f, i) => (
                    <span key={i} className="text-xs text-text-tertiary bg-surface-tertiary rounded-full px-2 py-0.5 truncate max-w-24">{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
