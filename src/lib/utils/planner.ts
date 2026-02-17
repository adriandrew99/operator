import type { Task, TimePeriod } from '@/lib/types/database';
import { ENERGY_PERIOD_MAP } from '@/lib/constants';
import { getTaskMLU } from '@/lib/utils/mental-load';

/**
 * Parse a scheduled_time_block value into a TimePeriod.
 * Handles both legacy formats ("9:00", "14", "9") and new period strings ("morning").
 */
export function parseTimePeriod(timeBlock: string | null): TimePeriod {
  if (!timeBlock) return 'morning';

  // Direct period values
  if (timeBlock === 'morning' || timeBlock === 'afternoon' || timeBlock === 'evening') {
    return timeBlock;
  }

  // Legacy hour-based format: "9:00", "14:30", "9", etc.
  let hour: number;
  if (timeBlock.includes(':')) {
    hour = parseInt(timeBlock.split(':')[0], 10);
  } else {
    hour = parseInt(timeBlock, 10);
  }

  if (isNaN(hour)) return 'morning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Map a calendar event start_time ("09:00", "14:30") to a period.
 */
export function eventTimeToPeriod(startTime: string): TimePeriod {
  const hour = parseInt(startTime.split(':')[0], 10);
  if (isNaN(hour) || hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Check if a task's energy type matches the ideal for a given period.
 */
export function getEnergyMatch(
  task: Pick<Task, 'energy' | 'weight'>,
  period: TimePeriod
): 'optimal' | 'acceptable' | 'mismatch' {
  const ideal = ENERGY_PERIOD_MAP[period];
  if (!ideal) return 'acceptable';

  const energy = task.energy || 'admin';
  const weight = task.weight || 'medium';

  // Optimal: energy type matches AND weight is in ideal range
  if (energy === ideal.ideal_energy && ideal.ideal_weights.includes(weight)) {
    return 'optimal';
  }

  // Mismatch: creative high-weight task in evening, or admin low in morning
  if (period === 'morning' && energy === 'admin' && weight === 'low') return 'mismatch';
  if (period === 'evening' && energy === 'creative' && weight === 'high') return 'mismatch';

  return 'acceptable';
}

/**
 * Calculate MLU for tasks in a specific period on a specific date.
 */
export function calculatePeriodLoad(
  tasks: Task[],
  date: string,
  period: TimePeriod
): number {
  return tasks
    .filter(t => t.scheduled_date === date && parseTimePeriod(t.scheduled_time_block) === period)
    .filter(t => !t.is_personal)
    .reduce((sum, t) => sum + getTaskMLU(t), 0);
}

/**
 * Get admin vs creative MLU split for all tasks on a given date.
 */
export function getDayEnergyBreakdown(
  tasks: Task[],
  date: string
): { admin: number; creative: number } {
  const dayTasks = tasks.filter(t => t.scheduled_date === date && !t.is_personal);
  let admin = 0;
  let creative = 0;
  for (const t of dayTasks) {
    const mlu = getTaskMLU(t);
    if ((t.energy || 'admin') === 'creative') {
      creative += mlu;
    } else {
      admin += mlu;
    }
  }
  return { admin, creative };
}
