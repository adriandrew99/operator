export interface RecurringTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  frequency: 'daily' | 'weekdays' | 'weekly' | 'custom';
  day_of_week: number | null;
  days_of_week: number[] | null;
  scheduled_time: string | null;
  client_id: string | null;
  weight: string | null;
  energy: string | null;
  estimated_minutes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringTaskCompletion {
  id: string;
  user_id: string;
  recurring_task_id: string;
  date: string;
  completed_at: string;
}

export interface RecurringTaskWithStatus extends RecurringTask {
  completedToday: boolean;
}
