'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { Card, CardTitle, CardValue } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
    <div className="space-y-8">
      {/* Prompts */}
      <div className="space-y-4">
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
          Reflection Prompts
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMPTS.map((prompt) => (
            <div key={prompt.field} className="card-surface border border-border rounded-2xl card-hover p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-accent text-sm">{prompt.icon}</span>
                <p className="text-xs text-text-secondary">{prompt.question}</p>
              </div>
              <textarea
                value={(localReview?.[prompt.field as keyof WeeklyReview] as string) || ''}
                onChange={(e) => handleFieldChange(prompt.field, e.target.value)}
                placeholder="Write your reflection..."
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none min-h-[60px]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Trend Chart (simple SVG) */}
      {weeklyScores.length > 1 && (
        <div className="space-y-3">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
            Operator Score Trend
          </p>
          <div className="card-surface border border-border rounded-2xl card-hover p-5">
            <div className="h-32 flex items-end gap-2">
              {weeklyScores.slice(-8).map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-secondary">{w.avg}</span>
                  <div
                    className={cn(
                      'w-full transition-all duration-500',
                      w.avg >= 70 ? 'bg-accent' : w.avg >= 40 ? 'bg-warning' : 'bg-danger'
                    )}
                    style={{ height: `${(w.avg / maxScore) * 100}%`, minHeight: '4px' }}
                  />
                  <span className="text-[8px] text-text-tertiary">{formatDate(w.week)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Focus Areas */}
      <div className="space-y-3">
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
          Focus Areas for Next Week
        </p>
        <div className="space-y-2">
          {['focus_area_1', 'focus_area_2', 'focus_area_3'].map((field, i) => (
            <div key={field} className="flex items-center gap-3">
              <span className="text-xs text-accent font-mono">{i + 1}</span>
              <input
                value={(localReview?.[field as keyof WeeklyReview] as string) || ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                placeholder={`Focus area ${i + 1}...`}
                className="flex-1 bg-surface-secondary border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent transition-colors"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Review History */}
      {history.length > 1 && (
        <div className="space-y-3">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
            Past Reviews
          </p>
          <div className="space-y-1">
            {history.slice(1).map((r) => (
              <div key={r.id} className="card-surface border border-border rounded-xl card-hover px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-primary">Week of {formatDate(r.week_start)}</p>
                  {r.total_operator_score_avg != null && (
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-text-tertiary">Score: {r.total_operator_score_avg}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap max-w-48">
                  {[r.focus_area_1, r.focus_area_2, r.focus_area_3].filter(Boolean).map((f, i) => (
                    <span key={i} className="text-[10px] text-text-tertiary bg-surface-tertiary rounded-md px-1.5 py-0.5 truncate max-w-24">{f}</span>
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
