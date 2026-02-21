import type { CheckInRatings, ScoreBreakdownV2 } from '@/lib/types/database';

/**
 * Operator Score V2 — Blended auto-calculated + self-assessed score
 *
 * Dimensions:
 *   Execution  (max 25) — auto: task completion + MLU delivery
 *   Habits     (max 20) — auto: fundamental completion rate
 *   Focus      (max 12) — self: focus & deep work quality (1-5)
 *   Energy     (max 10) — self: energy & recovery level (1-5)
 *   Decisions  (max  8) — self: decision quality (1-5)
 *   Clarity    (max  8) — self: priority clarity & direction (1-5)
 *   Stress     (max  7) — self: stress control & composure (1-5)
 *   Momentum   (max 10) — auto: consecutive good-day streak
 *
 * Without check-in, max is 55. Creates strong incentive to check in daily.
 */

export interface ScoreInputs {
  // Auto-calculated
  tasksCompleted: number;
  tasksTotal: number;
  mluDelivered: number;
  mluCapacity: number;
  fundamentalsHit: number;
  fundamentalsTotal: number;
  streakDays: number;
  // Self-assessed (null if no check-in yet)
  checkIn: CheckInRatings | null;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdownV2;
  hasCheckedIn: boolean;
}

export function calculateOperatorScoreV2(inputs: ScoreInputs): ScoreResult {
  // --- EXECUTION (max 25) ---
  // Blends task completion ratio (60%) with MLU delivery ratio (40%)
  const taskRatio = inputs.tasksTotal > 0
    ? inputs.tasksCompleted / inputs.tasksTotal : 0;
  const mluRatio = inputs.mluCapacity > 0
    ? Math.min(1, inputs.mluDelivered / inputs.mluCapacity) : 0;
  const executionRaw = taskRatio * 0.6 + mluRatio * 0.4;
  const execution = Math.round(executionRaw * 25);

  // --- HABITS (max 20) ---
  const habitsRatio = inputs.fundamentalsTotal > 0
    ? inputs.fundamentalsHit / inputs.fundamentalsTotal : 0;
  const habits = Math.round(habitsRatio * 20);

  // --- FOCUS (max 12) — self-assessed, 0 if no check-in ---
  const focus = inputs.checkIn
    ? Math.round((inputs.checkIn.focus / 5) * 12) : 0;

  // --- ENERGY (max 10) — self-assessed, 0 if no check-in ---
  const energy = inputs.checkIn
    ? Math.round((inputs.checkIn.energy / 5) * 10) : 0;

  // --- DECISIONS (max 8) — self-assessed, 0 if no check-in ---
  const decisions = inputs.checkIn
    ? Math.round((inputs.checkIn.decisions / 5) * 8) : 0;

  // --- CLARITY (max 8) — self-assessed, 0 if no check-in ---
  const clarity = inputs.checkIn
    ? Math.round(((inputs.checkIn.clarity ?? 3) / 5) * 8) : 0;

  // --- STRESS (max 7) — self-assessed, 0 if no check-in ---
  const stress = inputs.checkIn
    ? Math.round(((inputs.checkIn.stress ?? 3) / 5) * 7) : 0;

  // --- MOMENTUM (max 10) — auto: 1pt per streak day, caps at 10 ---
  const momentum = Math.min(10, inputs.streakDays);

  const score = Math.min(100, execution + habits + focus + energy + decisions + clarity + stress + momentum);

  return {
    score,
    breakdown: { execution, habits, focus, energy, decisions, clarity, stress, momentum },
    hasCheckedIn: inputs.checkIn !== null,
  };
}

/**
 * Dimension labels and max values for display
 */
export const SCORE_DIMENSIONS = [
  { key: 'execution' as const, label: 'Execution', max: 25, auto: true },
  { key: 'habits' as const, label: 'Habits', max: 20, auto: true },
  { key: 'focus' as const, label: 'Focus', max: 12, auto: false },
  { key: 'energy' as const, label: 'Energy', max: 10, auto: false },
  { key: 'decisions' as const, label: 'Decisions', max: 8, auto: false },
  { key: 'clarity' as const, label: 'Clarity', max: 8, auto: false },
  { key: 'stress' as const, label: 'Control', max: 7, auto: false },
  { key: 'momentum' as const, label: 'Momentum', max: 10, auto: true },
] as const;

/**
 * Score thresholds for visual feedback
 */
export function getScoreLevel(score: number): 'excellent' | 'good' | 'average' | 'low' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  return 'low';
}

export function getScoreColor(level: ReturnType<typeof getScoreLevel>): string {
  switch (level) {
    case 'excellent': return 'text-text-primary';
    case 'good': return 'text-text-primary';
    case 'average': return 'text-text-secondary';
    case 'low': return 'text-text-tertiary';
  }
}

// --- Legacy V1 (kept for backward compat) ---

export interface ScoreBreakdown {
  work: number;
  health: number;
  growth: number;
  total: number;
}

export function calculateOperatorScoreV1(
  todayTasksCompleted: number,
  todayTasksTotal: number,
  healthFundamentalsHit: number,
  healthFundamentalsTotal: number,
  streakDays: number
): ScoreBreakdown {
  let workScore = 0;
  if (todayTasksTotal > 0) {
    workScore = Math.round((todayTasksCompleted / todayTasksTotal) * 40);
  }
  let healthScore = 0;
  if (healthFundamentalsTotal > 0) {
    healthScore = Math.round((healthFundamentalsHit / healthFundamentalsTotal) * 40);
  }
  const growthScore = Math.min(20, streakDays * 2);
  const total = Math.min(100, workScore + healthScore + growthScore);
  return { work: workScore, health: healthScore, growth: growthScore, total };
}
