-- ============================================================
-- RECURRING TASKS (Daily Reminders)
-- ============================================================

CREATE TABLE public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'personal' CHECK (category IN ('strategy', 'clients', 'content', 'personal')),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc. Only for 'weekly'
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recurring_tasks_user ON public.recurring_tasks(user_id, is_active);

-- Daily task completions (tracks whether a recurring task was done on a given day)
CREATE TABLE public.recurring_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recurring_task_id UUID NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recurring_task_id, date)
);

CREATE INDEX idx_recurring_completions_user_date ON public.recurring_task_completions(user_id, date);

-- RLS
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring_tasks" ON public.recurring_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_tasks" ON public.recurring_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_tasks" ON public.recurring_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_tasks" ON public.recurring_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recurring_task_completions" ON public.recurring_task_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_task_completions" ON public.recurring_task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_task_completions" ON public.recurring_task_completions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_task_completions" ON public.recurring_task_completions FOR DELETE USING (auth.uid() = user_id);
