'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { DAILY_CAPACITY } from '@/lib/utils/mental-load';
import { getScoreLevel, getScoreColor } from '@/lib/utils/score';
import type { Task, Client, CalendarEvent, OperatorScore } from '@/lib/types/database';

interface FocusBlockProps {
  todayTasks: Task[];
  completedTodayTasks: Task[];
  todayScore: OperatorScore | null;
  streakDays: number;
  fundamentalsHit: number;
  fundamentalsTotal: number;
  dailyCapacity?: number;
  calendarEvents?: CalendarEvent[];
  clients: Client[];
  completedCount: number;
  totalCount: number;
}

export function FocusBlock({
  todayTasks,
  completedTodayTasks,
  todayScore,
  streakDays,
  fundamentalsHit,
  fundamentalsTotal,
  dailyCapacity = DAILY_CAPACITY,
  calendarEvents = [],
  clients,
  completedCount,
  totalCount,
}: FocusBlockProps) {
  const score = todayScore?.score ?? 0;
  const scoreLevel = getScoreLevel(score);
  const scoreColor = getScoreColor(scoreLevel);

  return (
    <div className="card-glass rounded-2xl p-8 sm:p-10">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 sm:gap-12">
        {/* Hero score */}
        <Link href="/score" className="group flex flex-col items-center shrink-0">
          <div className={cn(
            'rounded-2xl p-6 transition-all duration-300 group-hover:scale-[1.02]',
            score >= 70 && 'score-glow'
          )}>
            <p className={cn(
              'display-number-hero transition-opacity group-hover:opacity-80',
              score ? scoreColor : 'text-text-tertiary'
            )}>
              {score || '--'}
            </p>
          </div>
          <p className="text-[11px] text-text-tertiary mt-3 uppercase tracking-[0.12em] font-medium">
            Operator Score
          </p>
        </Link>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-3 gap-6 sm:gap-8 w-full sm:w-auto sm:pt-4">
          <div className="text-center sm:text-left">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Tasks</p>
            <p className="display-number-medium text-text-primary leading-none">
              {completedCount}
              <span className="text-base font-normal text-text-tertiary ml-0.5">/{totalCount}</span>
            </p>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Habits</p>
            <p className="display-number-medium text-text-primary leading-none">
              {fundamentalsHit}
              <span className="text-base font-normal text-text-tertiary ml-0.5">/{fundamentalsTotal}</span>
            </p>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Streak</p>
            <p className="display-number-medium text-text-primary leading-none">
              {streakDays}
              <span className="text-base font-normal text-text-tertiary ml-0.5">d</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
