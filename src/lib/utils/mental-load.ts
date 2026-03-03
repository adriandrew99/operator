import type { Task } from '@/lib/types/database';

/**
 * Mental Load Units (MLU)
 *
 * Quantifies how much cognitive bandwidth a task demands based on
 * two dimensions: weight (complexity) and energy type (cognitive mode).
 *
 * Energy types: admin (lightweight) and creative (focused).
 *
 * Calibrated against real-world capacity:
 *   ~20 low-admin tasks/day  → 0.5 MLU each → 10 total
 *   ~8  medium tasks/day     → 2 MLU each   → 16 total
 *   ~3  high-creative/day    → 5 MLU each   → 15 total
 *
 * Default daily capacity: 20 MLU (customisable per user)
 * Warning zone: ~80% of capacity
 * Overload zone: >100% of capacity
 */

// MLU lookup: [weight][energy]
// Note: 'deep' kept for backward compat with historical tasks — maps same as creative
const MLU_TABLE: Record<string, Record<string, number>> = {
  low:    { admin: 0.5, creative: 1.5, deep: 1.5 },
  medium: { admin: 1.5, creative: 2.5, deep: 2.5 },
  high:   { admin: 3,   creative: 5,   deep: 5   },
};

export const DAILY_CAPACITY = 20;

export function getTaskMLU(task: Pick<Task, 'weight' | 'energy'>): number {
  const weight = task.weight || 'medium';
  const energy = task.energy || 'admin';
  return MLU_TABLE[weight]?.[energy] ?? 2;
}

/**
 * Estimate how long a task takes (in minutes) based on its weight.
 * Maps directly to the auto-assigned category estimates:
 *   low = ~5min, medium = ~30min, high = ~60min
 * Returns the task's explicit estimated_minutes if set, otherwise derives from weight.
 */
const WEIGHT_MINUTES: Record<string, number> = { low: 5, medium: 30, high: 60 };

export function getEstimatedMinutes(task: Pick<Task, 'weight' | 'energy'> & { estimated_minutes?: number | null }): number {
  if (task.estimated_minutes && task.estimated_minutes > 0) return task.estimated_minutes;
  return WEIGHT_MINUTES[task.weight || 'medium'] ?? 30;
}

export function calculateDailyLoad(tasks: Pick<Task, 'weight' | 'energy' | 'is_personal'>[]): number {
  return tasks
    .filter(t => !('is_personal' in t && t.is_personal))
    .reduce((sum, t) => sum + getTaskMLU(t), 0);
}

export type LoadLevel = 'light' | 'moderate' | 'heavy' | 'overloaded';

export function getLoadLevel(mlu: number, capacity: number = DAILY_CAPACITY): LoadLevel {
  if (mlu <= capacity * 0.5) return 'light';
  if (mlu <= capacity * 0.8) return 'moderate';
  if (mlu <= capacity) return 'heavy';
  return 'overloaded';
}

export function getLoadColor(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'text-text-primary';
    case 'moderate': return 'text-text-primary';
    case 'heavy': return 'text-text-secondary';
    case 'overloaded': return 'text-text-tertiary';
  }
}

export function getLoadBgColor(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'bg-surface-tertiary/50 border-border';
    case 'moderate': return 'bg-surface-tertiary/50 border-border';
    case 'heavy': return 'bg-surface-tertiary/50 border-border';
    case 'overloaded': return 'bg-surface-tertiary/50 border-border';
  }
}

/**
 * Build a suggestion for how to redistribute overload.
 * Returns a human-readable suggestion string, or null if not overloaded.
 */
export function getOverloadSuggestion(tasks: Pick<Task, 'weight' | 'energy' | 'is_personal'>[], capacity: number = DAILY_CAPACITY): string | null {
  const totalMLU = calculateDailyLoad(tasks);
  if (totalMLU <= capacity) return null;

  const nonPersonal = tasks.filter(t => !('is_personal' in t && t.is_personal));
  const excess = totalMLU - capacity;
  const highCount = nonPersonal.filter(t => (t.weight || 'medium') === 'high').length;
  const mediumCount = nonPersonal.filter(t => (t.weight || 'medium') === 'medium').length;
  const creativeCount = nonPersonal.filter(t => (t.energy || 'admin') === 'creative').length;

  // Build contextual suggestion
  if (highCount >= 4) {
    return `${highCount} high-weight tasks is too many for one day. Move ${highCount - 2} to another day.`;
  }
  if (highCount >= 3 && creativeCount >= 3) {
    return `${highCount} high-weight + ${creativeCount} creative tasks will burn you out. Shift a high-weight task to tomorrow.`;
  }
  if (mediumCount >= 9) {
    return `${mediumCount} medium tasks is pushing it. Move ${mediumCount - 7} to lighten the load.`;
  }
  if (excess <= 3) {
    return 'Slightly over capacity. Consider moving 1 medium task to tomorrow.';
  }
  if (excess <= 6) {
    return 'Significantly overloaded. Move 2-3 tasks to spread the load across the week.';
  }
  return `${Math.round(excess)} MLU over capacity. This day needs serious trimming — move high-weight tasks to lighter days.`;
}

/**
 * Suggest a daily MLU capacity based on historical planned/scheduled load per day.
 *
 * Filters out light days (< 5 MLU) which are likely off days, weekends, or days
 * the user barely used the system — these would skew the suggestion downward.
 *
 * Uses the 75th percentile of qualifying working days as the recommendation.
 * This represents the user's "cruising speed" on a solid working day —
 * not the lightest days, not the absolute max, but where they typically operate.
 *
 * Returns null if fewer than 5 qualifying working days.
 */
export function suggestCapacityFromHistory(
  completedDays: { date: string; totalMLU: number }[]
): number | null {
  // Filter out light days — off days or barely-used days that would skew low
  const workingDays = completedDays
    .filter(d => d.totalMLU >= 5)
    .map(d => d.totalMLU)
    .sort((a, b) => a - b);

  if (workingDays.length < 5) return null;

  // 75th percentile — represents a solid working day, not the max
  const idx = Math.floor(workingDays.length * 0.75);
  const suggested = workingDays[Math.min(idx, workingDays.length - 1)];

  return Math.round(suggested);
}

/**
 * Derive MLU capacity from calibration quiz answers.
 * Uses average MLU per weight tier (midpoint of admin/creative).
 */
export function deriveCapacityFromQuiz(highCount: number, mediumCount: number, lowCount: number): number {
  // Average MLU per tier: (admin + creative) / 2
  const highAvg = (MLU_TABLE.high.admin + MLU_TABLE.high.creative) / 2; // 4
  const medAvg = (MLU_TABLE.medium.admin + MLU_TABLE.medium.creative) / 2; // 2
  const lowAvg = (MLU_TABLE.low.admin + MLU_TABLE.low.creative) / 2; // 1

  return Math.round(highCount * highAvg + mediumCount * medAvg + lowCount * lowAvg);
}
