'use client';

import { useState } from 'react';
import { ScoreHero } from '@/components/score/ScoreHero';
import { DailyCheckIn } from '@/components/score/DailyCheckIn';
import { RetroactiveCheckIn } from '@/components/score/RetroactiveCheckIn';
import { ScoreTrendChart } from '@/components/score/ScoreTrendChart';
import { DimensionBreakdown } from '@/components/score/DimensionBreakdown';
import { WeeklyAverages } from '@/components/score/WeeklyAverages';
import { ScoreMilestones } from '@/components/score/ScoreMilestones';
import { BentoGrid, BentoItem } from '@/components/ui/BentoGrid';
import type { OperatorScore, CheckInRatings, ScoreBreakdownV2 } from '@/lib/types/database';

interface ScoreDashboardProps {
  todayScore: OperatorScore | null;
  scoreHistory: {
    date: string;
    score: number;
    breakdown: ScoreBreakdownV2 | Record<string, number>;
    check_in: CheckInRatings | null;
    version: number;
  }[];
  scoreStats: {
    personalBest: number;
    personalBestDate: string;
    longestStreak: number;
    weeklyAverages: { weekStart: string; avg: number; count: number; checkedInCount: number }[];
    dimensionAvgs: Record<string, number> | null;
    checkInRate: number;
    totalDays: number;
  } | null;
  streakDays: number;
  autoMetrics: {
    tasksCompleted: number;
    tasksTotal: number;
    mluDelivered: number;
    mluCapacity: number;
    fundamentalsHit: number;
    fundamentalsTotal: number;
  };
}

export function ScoreDashboard({
  todayScore,
  scoreHistory,
  scoreStats,
  streakDays,
  autoMetrics,
}: ScoreDashboardProps) {
  const [currentScore, setCurrentScore] = useState(todayScore);

  const hasCheckedIn = currentScore?.check_in !== null && currentScore?.check_in !== undefined;
  const breakdown = currentScore?.version === 2
    ? (currentScore.breakdown as ScoreBreakdownV2)
    : null;

  function handleCheckInSaved(updatedScore: OperatorScore) {
    setCurrentScore(updatedScore);
  }

  // Find missed days (days with a score but no check-in in the last 7 days)
  const _missedDays = scoreHistory
    .filter(h => h.check_in === null && h.version === 2)
    .slice(-7)
    .map(h => h.date);
  void _missedDays;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Operator Score</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Track daily performance across all dimensions</p>
      </div>

      <BentoGrid columns={4}>
        {/* ━━━ HERO: Score ring + dimension bars ━━━ */}
        <BentoItem span="wide" delay={0}>
          <ScoreHero
            score={currentScore?.score ?? 0}
            breakdown={breakdown}
            hasCheckedIn={hasCheckedIn}
            streakDays={streakDays}
            autoMetrics={autoMetrics}
          />
        </BentoItem>

        {/* ━━━ DAILY CHECK-IN ━━━ */}
        <BentoItem span="wide" delay={60}>
          <DailyCheckIn
            existingCheckIn={currentScore?.check_in ?? null}
            existingNotes={currentScore?.notes ?? null}
            onSaved={handleCheckInSaved}
          />
        </BentoItem>

        {/* ━━━ RETROACTIVE CHECK-IN (missed days) ━━━ */}
        <BentoItem span="wide" delay={90}>
          <RetroactiveCheckIn scoreHistory={scoreHistory} />
        </BentoItem>

        {/* ━━━ 30-DAY TREND ━━━ */}
        {scoreHistory.length > 0 && (
          <BentoItem span="full" delay={120}>
            <section className="bg-surface-secondary border border-border rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">30-Day Trend</h2>
              <ScoreTrendChart history={scoreHistory} />
            </section>
          </BentoItem>
        )}

        {/* ━━━ DIMENSION BREAKDOWN ━━━ */}
        {scoreStats?.dimensionAvgs && (
          <BentoItem span="wide" delay={180}>
            <section className="bg-surface-secondary border border-border rounded-2xl p-6 h-full">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Dimension Averages</h2>
              <DimensionBreakdown averages={scoreStats.dimensionAvgs} />
            </section>
          </BentoItem>
        )}

        {/* ━━━ WEEKLY AVERAGES ━━━ */}
        {scoreStats && scoreStats.weeklyAverages.length > 0 && (
          <BentoItem span="wide" delay={240}>
            <section className="bg-surface-secondary border border-border rounded-2xl p-6 h-full">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Weekly Progress</h2>
              <WeeklyAverages weeks={scoreStats.weeklyAverages} />
            </section>
          </BentoItem>
        )}

        {/* ━━━ MILESTONES ━━━ */}
        {scoreStats && (
          <BentoItem span="full" delay={300}>
            <ScoreMilestones
              personalBest={scoreStats.personalBest}
              personalBestDate={scoreStats.personalBestDate}
              longestStreak={scoreStats.longestStreak}
              currentStreak={streakDays}
              checkInRate={scoreStats.checkInRate}
              totalDays={scoreStats.totalDays}
            />
          </BentoItem>
        )}
      </BentoGrid>
    </div>
  );
}
