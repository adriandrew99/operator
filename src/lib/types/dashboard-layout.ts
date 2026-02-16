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
    insights: boolean;
    patterns: boolean;
    revenue_radar: boolean;
    summary_cards: boolean;
    revenue_profit_chart: boolean;
    energy_investment_chart: boolean;
    energy_per_client: boolean;
    client_energy_breakdown: boolean;
    energy_by_client: boolean;
    task_volume_chart: boolean;
    efficiency_comparison: boolean;
    mlu_explainer: boolean;
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
    insights: true,
    patterns: true,
    revenue_radar: true,
    summary_cards: true,
    revenue_profit_chart: true,
    energy_investment_chart: true,
    energy_per_client: true,
    client_energy_breakdown: true,
    energy_by_client: true,
    task_volume_chart: true,
    efficiency_comparison: true,
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

export const ANALYTICS_SECTION_LABELS: Record<keyof DashboardLayoutPreferences['analytics'], string> = {
  weekly_debrief: 'Weekly Debrief',
  insights: 'Insights & Recommendations',
  patterns: 'Detected Patterns',
  revenue_radar: 'Revenue Radar',
  summary_cards: 'Summary Cards',
  revenue_profit_chart: 'Revenue & Profit Over Time',
  energy_investment_chart: 'Weekly Energy Investment',
  energy_per_client: 'Mental Energy Per Client',
  client_energy_breakdown: 'Client Energy & Time Breakdown',
  energy_by_client: 'Energy by Client',
  task_volume_chart: 'Weekly Task Volume',
  efficiency_comparison: 'Client Efficiency Comparison',
  mlu_explainer: 'How MLU Works',
};
