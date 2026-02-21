'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { getTaskMLU, DAILY_CAPACITY, calculateDailyLoad, getLoadLevel } from '@/lib/utils/mental-load';
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

function getEnergyState(hour: number): { label: string; level: 'peak' | 'high' | 'medium' | 'low'; description: string } {
  if (hour >= 6 && hour < 11) return { label: 'Peak', level: 'peak', description: 'Highest cognitive bandwidth — do your hardest work now' };
  if (hour >= 11 && hour < 14) return { label: 'High', level: 'high', description: 'Still sharp — tackle demanding tasks before the dip' };
  if (hour >= 14 && hour < 17) return { label: 'Declining', level: 'medium', description: 'Energy dipping — shift to structured or routine tasks' };
  return { label: 'Wind Down', level: 'low', description: 'Low bandwidth — admin, planning, or creative thinking' };
}

function getEnergyAccentColor(level: string): string {
  switch (level) {
    case 'peak': return 'text-accent';
    case 'high': return 'text-text-primary';
    case 'medium': return 'text-text-secondary';
    case 'low': return 'text-text-tertiary';
    default: return 'text-text-secondary';
  }
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

  const energyData = useMemo(() => {
    const hour = new Date().getHours();
    const state = getEnergyState(hour);

    // Calculate MLU
    const allTasks = [...todayTasks, ...completedTodayTasks].filter(t => !t.is_personal);
    const totalMLU = allTasks.reduce((sum, t) => sum + getTaskMLU(t), 0);
    const completedMLU = completedTodayTasks.filter(t => !t.is_personal).reduce((sum, t) => sum + getTaskMLU(t), 0);
    const remainingMLU = Math.max(0, totalMLU - completedMLU);
    const capacityPct = Math.min(100, (totalMLU / dailyCapacity) * 100);
    const usedPct = totalMLU > 0 ? Math.min(100, (completedMLU / dailyCapacity) * 100) : 0;
    const loadLevel = getLoadLevel(totalMLU, dailyCapacity);

    // Energy split
    let creativeMLU = 0;
    let adminMLU = 0;
    for (const task of allTasks) {
      const mlu = getTaskMLU(task);
      if ((task.energy || 'admin') === 'creative') creativeMLU += mlu;
      else adminMLU += mlu;
    }

    return { state, totalMLU, completedMLU, remainingMLU, capacityPct, usedPct, loadLevel, creativeMLU, adminMLU };
  }, [todayTasks, completedTodayTasks, dailyCapacity]);

  const energyLevels = [
    { key: 'peak', label: 'Peak', active: energyData.state.level === 'peak' },
    { key: 'high', label: 'High', active: energyData.state.level === 'high' },
    { key: 'medium', label: 'Med', active: energyData.state.level === 'medium' },
    { key: 'low', label: 'Low', active: energyData.state.level === 'low' },
  ];

  return (
    <div className="card-glass rounded-2xl p-8 sm:p-10">
      <div className="flex flex-col gap-8">
        {/* ━━━ TOP ROW: Energy state + Capacity bar ━━━ */}
        <div className="flex flex-col sm:flex-row items-start gap-8 sm:gap-12">
          {/* Energy state — primary hero */}
          <div className="shrink-0">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-medium mb-2">
              Mental Energy
            </p>
            <p className={cn('display-number-large leading-none', getEnergyAccentColor(energyData.state.level))}>
              {energyData.state.label}
            </p>
            <p className="text-xs text-text-tertiary mt-2 max-w-[240px] leading-relaxed">
              {energyData.state.description}
            </p>
          </div>

          {/* Energy level bars */}
          <div className="flex items-end gap-3 h-14 sm:pt-6">
            {energyLevels.map((level, i) => {
              const heights = [48, 36, 24, 12];
              return (
                <div key={level.key} className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'w-6 rounded-sm transition-all duration-500',
                      level.active
                        ? level.key === 'peak' ? 'bg-accent/50' : 'bg-text-primary/30'
                        : 'bg-surface-tertiary'
                    )}
                    style={{ height: `${heights[i]}px` }}
                  />
                  <span className={cn(
                    'text-[10px]',
                    level.active ? (level.key === 'peak' ? 'text-accent' : 'text-text-secondary') : 'text-text-tertiary'
                  )}>
                    {level.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Capacity gauge — right side */}
          <div className="flex-1 w-full sm:w-auto sm:pt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium">Capacity</p>
              <p className="text-xs font-mono text-text-tertiary">
                {energyData.remainingMLU.toFixed(1)} MLU left
              </p>
            </div>
            {/* Capacity bar */}
            <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div className="h-full flex">
                {/* Completed portion */}
                <div
                  className="h-full bg-accent/40 transition-all duration-700"
                  style={{ width: `${energyData.usedPct}%` }}
                />
                {/* Remaining planned portion */}
                <div
                  className="h-full bg-text-tertiary/20 transition-all duration-700"
                  style={{ width: `${Math.max(0, energyData.capacityPct - energyData.usedPct)}%` }}
                />
              </div>
            </div>
            {/* Split legend */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent/40" />
                <span className="text-[10px] text-text-tertiary">Done {energyData.completedMLU.toFixed(1)}</span>
              </div>
              {energyData.creativeMLU > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-text-primary/50" />
                  <span className="text-[10px] text-text-tertiary">Creative {energyData.creativeMLU.toFixed(1)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-text-tertiary/40" />
                <span className="text-[10px] text-text-tertiary">Admin {energyData.adminMLU.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ━━━ BOTTOM ROW: Secondary stats ━━━ */}
        <div className="grid grid-cols-4 gap-6 border-t border-border pt-6">
          <div className="text-center sm:text-left">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Tasks</p>
            <p className="text-lg font-semibold text-text-primary leading-none font-mono">
              {completedCount}
              <span className="text-sm font-normal text-text-tertiary ml-0.5">/{totalCount}</span>
            </p>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Habits</p>
            <p className="text-lg font-semibold text-text-primary leading-none font-mono">
              {fundamentalsHit}
              <span className="text-sm font-normal text-text-tertiary ml-0.5">/{fundamentalsTotal}</span>
            </p>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Streak</p>
            <p className="text-lg font-semibold text-text-primary leading-none font-mono">
              {streakDays}
              <span className="text-sm font-normal text-text-tertiary ml-0.5">d</span>
            </p>
          </div>

          <Link href="/score" className="text-center sm:text-left group">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Score</p>
            <p className={cn(
              'text-lg font-semibold leading-none font-mono transition-opacity group-hover:opacity-70',
              score ? scoreColor : 'text-text-tertiary'
            )}>
              {score || '--'}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
