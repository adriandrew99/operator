-- ============================================================
-- MIGRATION 3: Custom Fundamentals, Task Weights, Recurring Times
-- ============================================================

-- ============================================================
-- 1. CUSTOM FUNDAMENTALS
-- A new table for user-defined fundamentals instead of hardcoded columns
-- ============================================================

CREATE TABLE public.custom_fundamentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT '✓',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_custom_fundamentals_user ON public.custom_fundamentals(user_id, is_active);

-- Track daily completions of custom fundamentals
CREATE TABLE public.fundamental_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fundamental_id UUID NOT NULL REFERENCES public.custom_fundamentals(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fundamental_id, date)
);

CREATE INDEX idx_fundamental_completions_user_date ON public.fundamental_completions(user_id, date);

-- RLS for custom fundamentals
ALTER TABLE public.custom_fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamental_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom_fundamentals" ON public.custom_fundamentals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom_fundamentals" ON public.custom_fundamentals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own custom_fundamentals" ON public.custom_fundamentals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom_fundamentals" ON public.custom_fundamentals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own fundamental_completions" ON public.fundamental_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fundamental_completions" ON public.fundamental_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fundamental_completions" ON public.fundamental_completions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own fundamental_completions" ON public.fundamental_completions FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. TASK WEIGHTS + PROJECT/CLIENT ASSIGNMENT
-- ============================================================

ALTER TABLE public.tasks ADD COLUMN weight TEXT DEFAULT 'medium' CHECK (weight IN ('simple', 'medium', 'intensive'));
ALTER TABLE public.tasks ADD COLUMN project TEXT;
ALTER TABLE public.tasks ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Drop old category constraint and expand it
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_category_check CHECK (category IN ('strategy', 'clients', 'content', 'personal', 'admin'));

CREATE INDEX idx_tasks_user_weight ON public.tasks(user_id, weight);
CREATE INDEX idx_tasks_user_client ON public.tasks(user_id, client_id);

-- ============================================================
-- 3. RECURRING TASKS: TIME + SPECIFIC DAYS
-- ============================================================

ALTER TABLE public.recurring_tasks ADD COLUMN scheduled_time TIME;
ALTER TABLE public.recurring_tasks ADD COLUMN days_of_week INTEGER[];  -- array: [1,3,5] for Mon/Wed/Fri

-- Drop the old frequency constraint and expand it
ALTER TABLE public.recurring_tasks DROP CONSTRAINT IF EXISTS recurring_tasks_frequency_check;
ALTER TABLE public.recurring_tasks ADD CONSTRAINT recurring_tasks_frequency_check CHECK (frequency IN ('daily', 'weekdays', 'weekly', 'custom'));

-- Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_fundamentals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fundamental_completions;
