'use client';

import { cn } from '@/lib/utils/cn';
import { getEnergyMatch } from '@/lib/utils/planner';
import type { Task, TimePeriod } from '@/lib/types/database';

interface EnergyMatchIndicatorProps {
  task: Pick<Task, 'energy' | 'weight'>;
  period: TimePeriod;
}

export function EnergyMatchIndicator({ task, period }: EnergyMatchIndicatorProps) {
  const match = getEnergyMatch(task, period);

  // Don't show anything for acceptable (neutral) match
  if (match === 'acceptable') return null;

  return (
    <span
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full shrink-0',
        match === 'optimal' && 'bg-accent',
        match === 'mismatch' && 'bg-amber-400'
      )}
      title={
        match === 'optimal'
          ? 'Optimal energy match for this period'
          : 'This task may perform better in a different period'
      }
    />
  );
}
