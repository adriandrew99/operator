export interface DashboardLayoutPreferences {
  today: {
    day_overview: boolean;
    week_overview: boolean;
    fundamentals: boolean;
    revenue_goal: boolean;
    recurring_tasks: boolean;
    energy_router: boolean;
    revenue_radar: boolean;
    ai_insights: boolean;
    monkey_brain: boolean;
  };
  analytics: {
    weekly_debrief: boolean;
    hero_section: boolean;
    client_energy_revenue: boolean;
    insights_patterns: boolean;
    monthly_trends: boolean;
    client_health_scores: boolean;
    revenue_radar: boolean;
    revenue_profit_chart: boolean;
    energy_investment_chart: boolean;
    energy_by_client: boolean;
    task_volume_chart: boolean;
    mlu_explainer: boolean;
    // Legacy keys for backward compat (stored in user metadata)
    insights?: boolean;
    patterns?: boolean;
    summary_cards?: boolean;
    energy_per_client?: boolean;
    client_energy_breakdown?: boolean;
    efficiency_comparison?: boolean;
  };
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutPreferences = {
  today: {
    day_overview: true,
    week_overview: true,
    fundamentals: true,
    revenue_goal: true,
    recurring_tasks: true,
    energy_router: true,
    revenue_radar: true,
    ai_insights: true,
    monkey_brain: true,
  },
  analytics: {
    weekly_debrief: true,
    hero_section: true,
    client_energy_revenue: true,
    insights_patterns: true,
    monthly_trends: true,
    client_health_scores: true,
    revenue_radar: true,
    revenue_profit_chart: true,
    energy_investment_chart: true,
    energy_by_client: true,
    task_volume_chart: true,
    mlu_explainer: true,
  },
};

export const TODAY_SECTION_LABELS: Record<keyof DashboardLayoutPreferences['today'], string> = {
  day_overview: 'Day Overview',
  week_overview: 'Week Overview',
  fundamentals: 'Fundamentals',
  revenue_goal: 'Revenue Goal',
  recurring_tasks: 'Recurring Tasks',
  energy_router: 'Energy Router',
  revenue_radar: 'Revenue Radar',
  ai_insights: 'AI Insights',
  monkey_brain: 'Monkey Brain Override',
};

/** Labels for the new consolidated analytics sections */
export const ANALYTICS_SECTION_LABELS: Record<string, string> = {
  weekly_debrief: 'Weekly Debrief',
  hero_section: 'Portfolio Performance',
  client_energy_revenue: 'Client Energy vs Revenue',
  insights_patterns: 'Insights & Patterns',
  monthly_trends: 'Monthly Trends',
  client_health_scores: 'Client Health Scores',
  revenue_radar: 'Revenue Radar',
  revenue_profit_chart: 'Revenue & Profit Over Time',
  energy_investment_chart: 'Weekly Energy Investment',
  energy_by_client: 'Energy by Client',
  task_volume_chart: 'Weekly Task Volume',
  mlu_explainer: 'How MLU Works',
};
