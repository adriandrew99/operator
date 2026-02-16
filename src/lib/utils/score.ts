export interface ScoreBreakdown {
  work: number;
  health: number;
  growth: number;
  total: number;
}

export function calculateOperatorScore(
  todayTasksCompleted: number,
  todayTasksTotal: number,
  healthFundamentalsHit: number,
  healthFundamentalsTotal: number,
  streakDays: number
): ScoreBreakdown {
  // Work (max 40) — % of today's to-do list completed
  let workScore = 0;
  if (todayTasksTotal > 0) {
    workScore = Math.round((todayTasksCompleted / todayTasksTotal) * 40);
  }

  // Health (max 40) — health-related fundamentals completion
  let healthScore = 0;
  if (healthFundamentalsTotal > 0) {
    healthScore = Math.round((healthFundamentalsHit / healthFundamentalsTotal) * 40);
  }

  // Growth (max 20) — streak consistency
  const growthScore = Math.min(20, streakDays * 2);

  const total = Math.min(100, workScore + healthScore + growthScore);

  return {
    work: workScore,
    health: healthScore,
    growth: growthScore,
    total,
  };
}
