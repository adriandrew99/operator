export type TaskCategory = 'strategy' | 'clients' | 'content' | 'personal' | 'admin';
export type TaskWeight = 'low' | 'medium' | 'high';
export type EnergyType = 'admin' | 'creative';
export type TaskStatus = 'active' | 'completed' | 'archived';
export type LeadStage = 'lead' | 'conversation' | 'proposal_sent' | 'closed' | 'lost';
export type KnowledgeEntryType = 'reading' | 'idea' | 'lesson' | 'quote' | 'mental_model' | 'content_hook';
export type ReadingStatus = 'to_read' | 'reading' | 'completed';
export type ExpenseCategoryType = 'software' | 'hosting' | 'marketing' | 'office' | 'travel' | 'professional' | 'insurance' | 'subscriptions' | 'other';
export type TimePeriod = 'morning' | 'afternoon' | 'evening';

export interface Profile {
  id: string;
  full_name: string | null;
  accent_color: string;
  daily_mlu_capacity: number | null;
  work_start_hour?: number;
  work_end_hour?: number;
  work_days?: number[];
  monthly_salary?: number;
  staff_cost?: number;
  created_at: string;
  updated_at: string;
}

export interface DailyObjective {
  id: string;
  user_id: string;
  date: string;
  primary_objective: string | null;
  secondary_task_1: string | null;
  secondary_task_2: string | null;
  secondary_task_3: string | null;
  primary_completed: boolean;
  secondary_1_completed: boolean;
  secondary_2_completed: boolean;
  secondary_3_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Fundamental {
  id: string;
  user_id: string;
  date: string;
  gym: boolean;
  deep_work_90: boolean;
  steps_8k: boolean;
  no_alcohol: boolean;
  sleep_7h: boolean;
  meaningful_social: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeepWorkSession {
  id: string;
  user_id: string;
  date: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  completed: boolean;
  created_at: string;
}

export interface OperatorScore {
  id: string;
  user_id: string;
  date: string;
  score: number;
  breakdown: {
    fundamentals: number;
    objectives: number;
    deepWork: number;
    streak: number;
  };
  created_at: string;
}

export type SprintType = 'client' | 'personal';
export type SprintStatus = 'active' | 'completed' | 'paused';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  energy: EnergyType;
  status: TaskStatus;
  weight: TaskWeight;
  project: string | null;
  client_id: string | null;
  sprint_id: string | null;
  deadline: string | null;
  estimated_minutes: number | null;
  is_high_impact: boolean;
  is_revenue_generating: boolean;
  is_low_energy: boolean;
  is_urgent: boolean;
  is_personal: boolean;
  flagged_for_today: boolean;
  scheduled_date: string | null;
  scheduled_time_block: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sprint {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: SprintType;
  client_id: string | null;
  status: SprintStatus;
  progress: number;
  target_date: string | null;
  started_at: string;
  revenue_value: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFundamental {
  id: string;
  user_id: string;
  label: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FundamentalCompletion {
  id: string;
  user_id: string;
  fundamental_id: string;
  date: string;
  completed: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  retainer_amount: number | null;
  payment_day: number | null;
  contract_start: string | null;
  contract_end: string | null;
  contract_length_months: number | null;
  renewal_probability: number | null;
  risk_flag: boolean;
  risk_notes: string | null;
  is_active: boolean;
  is_ending: boolean;
  notice_period_months: number | null;
  termination_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: ExpenseCategoryType;
  date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  expense_type?: 'business' | 'personal';
  created_at: string;
}

export interface FinancialSnapshot {
  id: string;
  user_id: string;
  month: string;
  total_revenue: number;
  total_expenses: number;
  corp_tax_reserve: number;
  dividend_paid: number;
  net_worth: number | null;
  isa_balance: number;
  house_deposit_balance: number;
  house_deposit_target: number | null;
  starting_balance: number;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  label: string;
  target_amount: number;
  current_amount: number;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientMonthlyOverride {
  id: string;
  user_id: string;
  client_id: string;
  month: string; // 'YYYY-MM' format
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineLead {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  estimated_value: number | null;
  stage: LeadStage;
  probability: number | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  source: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntry {
  id: string;
  user_id: string;
  type: KnowledgeEntryType;
  title: string;
  content: string | null;
  reading_status: ReadingStatus | null;
  takeaway_1: string | null;
  takeaway_2: string | null;
  takeaway_3: string | null;
  applied: boolean;
  source: string | null;
  hook_platform: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  revenue_reflection: string | null;
  deep_work_reflection: string | null;
  training_reflection: string | null;
  drift_reflection: string | null;
  time_waste_reflection: string | null;
  meaning_reflection: string | null;
  focus_area_1: string | null;
  focus_area_2: string | null;
  focus_area_3: string | null;
  total_operator_score_avg: number | null;
  total_deep_work_minutes: number | null;
  total_fundamentals_hit: number | null;
  revenue_this_week: number | null;
  created_at: string;
  updated_at: string;
}

export type TimeBlock = 'early_morning' | 'morning' | 'late_morning' | 'afternoon' | 'late_afternoon' | 'evening' | 'night';
export type CalendarEventType = 'fixed' | 'deep_work' | 'admin' | 'break';

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  event_type: CalendarEventType;
  is_recurring: boolean;
  recurrence_days: number[] | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdentityGoal {
  id: string;
  user_id: string;
  label: string;
  target_value: number;
  current_value: number;
  unit: string;
  direction: 'up' | 'down';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyGoal {
  id: string;
  user_id: string;
  week_start: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DayTheme {
  id: string;
  user_id: string;
  week_start: string;
  day_index: number;
  theme: string;
  created_at: string;
  updated_at: string;
}
