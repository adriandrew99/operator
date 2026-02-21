'use client';

import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';

interface ScoreMilestonesProps {
  personalBest: number;
  personalBestDate: string;
  longestStreak: number;
  currentStreak: number;
  checkInRate: number;
  totalDays: number;
}

export function ScoreMilestones({
  personalBest,
  personalBestDate,
  longestStreak,
  currentStreak,
  checkInRate,
  totalDays,
}: ScoreMilestonesProps) {
  return (
    <section className="card-elevated rounded-2xl p-6">
      <h2 className="text-section-heading text-text-primary mb-4">Milestones</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MilestoneCard
          label="Personal Best"
          value={String(personalBest)}
          detail={personalBestDate ? formatDate(personalBestDate) : 'N/A'}
          accent={personalBest >= 80}
        />
        <MilestoneCard
          label="Current Streak"
          value={`${currentStreak}d`}
          detail={currentStreak >= longestStreak && currentStreak > 0 ? 'New record!' : `Best: ${longestStreak}d`}
          accent={currentStreak >= longestStreak && currentStreak > 0}
        />
        <MilestoneCard
          label="Check-In Rate"
          value={`${checkInRate}%`}
          detail="Last 30 days"
          accent={checkInRate >= 80}
        />
        <MilestoneCard
          label="Days Tracked"
          value={String(totalDays)}
          detail="All time"
        />
      </div>
    </section>
  );
}

function MilestoneCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-tertiary font-medium">{label}</p>
      <p className={cn('text-xl font-bold', accent ? 'text-text-primary' : 'text-text-primary')}>{value}</p>
      <p className="text-xs text-text-tertiary">{detail}</p>
    </div>
  );
}
