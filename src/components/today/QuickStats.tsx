'use client';

import { useMemo } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { getTaskMLU, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import type { Task } from '@/lib/types/database';

interface QuickStatsProps {
  todayTasks: Task[];
  completedCount: number;
  totalCount: number;
  streak: number;
  fundamentalsHit: number;
  fundamentalsTotal: number;
  dailyCapacity?: number;
}

export function QuickStats({
  todayTasks,
  completedCount,
  totalCount,
  streak,
  fundamentalsHit,
  fundamentalsTotal,
  dailyCapacity = DAILY_CAPACITY,
}: QuickStatsProps) {
  const mluUsed = useMemo(() =>
    todayTasks
      .filter(t => !t.is_personal)
      .reduce((sum, t) => sum + getTaskMLU(t), 0),
    [todayTasks]
  );

  const stats = [
    { label: 'Tasks', value: completedCount, suffix: `/${totalCount}`, color: '' },
    { label: 'MLU', value: mluUsed, suffix: `/${dailyCapacity}`, color: '', decimals: 1 },
    { label: 'Streak', value: streak, suffix: 'd', color: 'text-text-primary' },
    { label: 'Routines', value: fundamentalsHit, suffix: `/${fundamentalsTotal}`, color: '' },
  ];

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5 sm:p-6 h-full flex flex-col justify-center">
      <h3 className="section-label mb-3">Quick Stats</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map(s => (
          <div key={s.label}>
            <p className="text-xs text-text-tertiary mb-0.5">{s.label}</p>
            <p className="text-lg font-bold text-text-primary leading-tight">
              <AnimatedNumber
                value={s.value}
                decimals={s.decimals || 0}
                className={`text-lg ${s.color}`}
              />
              <span className={`text-sm font-normal ${s.color || 'text-text-tertiary'}`}>{s.suffix}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
