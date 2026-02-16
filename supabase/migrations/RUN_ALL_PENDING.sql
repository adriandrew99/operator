-- ============================================================
-- COMBINED MIGRATIONS 00007 → 00013
-- Paste this entire block into Supabase SQL Editor and run once
-- All statements are idempotent (safe to re-run)
-- ============================================================

-- ━━━ 00007: Recurring task client + weight columns ━━━
ALTER TABLE public.recurring_tasks
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight TEXT DEFAULT 'medium' CHECK (weight IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS energy TEXT DEFAULT 'admin' CHECK (energy IN ('deep', 'admin', 'creative')),
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- ━━━ 00008: Urgent flag + scheduling + calendar events ━━━
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_time_block TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_scheduled_time_block_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_scheduled_time_block_check CHECK (
      scheduled_time_block IS NULL OR scheduled_time_block IN (
        'early_morning','morning','late_morning','afternoon','late_afternoon','evening','night'
      )
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'fixed' CHECK (event_type IN ('fixed', 'deep_work', 'admin', 'break')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_days INTEGER[] DEFAULT NULL,
  color TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_events' AND policyname = 'Users can manage own calendar events'
  ) THEN
    CREATE POLICY "Users can manage own calendar events"
      ON calendar_events FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_ending BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notice_period_months INTEGER DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS termination_date DATE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_urgent ON tasks(user_id, is_urgent) WHERE is_urgent = true;
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(user_id, scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, date);

-- ━━━ 00009: Drop time block constraint (now using hour numbers) ━━━
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_scheduled_time_block_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_scheduled_time_block_check;
  END IF;
END $$;

UPDATE tasks SET scheduled_time_block = NULL WHERE scheduled_time_block IS NOT NULL AND scheduled_time_block !~ '^\d+$';

-- ━━━ 00010: Client monthly overrides ━━━
CREATE TABLE IF NOT EXISTS public.client_monthly_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, month)
);

ALTER TABLE public.client_monthly_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_monthly_overrides'
    AND policyname = 'Users can manage their own client overrides'
  ) THEN
    CREATE POLICY "Users can manage their own client overrides"
      ON public.client_monthly_overrides
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ━━━ 00011: Pipeline probability ━━━
ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT NULL;

-- ━━━ 00012: Recurring tasks admin category ━━━
ALTER TABLE public.recurring_tasks DROP CONSTRAINT IF EXISTS recurring_tasks_category_check;
ALTER TABLE public.recurring_tasks ADD CONSTRAINT recurring_tasks_category_check
  CHECK (category IN ('strategy', 'clients', 'content', 'personal', 'admin'));

-- ━━━ 00013: MLU capacity on profiles ━━━
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_mlu_capacity INTEGER DEFAULT NULL;

-- ━━━ 00014: Personal task flag ━━━
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;

-- ━━━ 00015: Expense type + work schedule + personal finance ━━━
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'business';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_start_hour INTEGER DEFAULT 9;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_end_hour INTEGER DEFAULT 17;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_days INTEGER[] DEFAULT '{1,2,3,4,5}';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_cost NUMERIC DEFAULT 0;

-- ━━━ 00016: Weekly debrief history ━━━
CREATE TABLE IF NOT EXISTS weekly_debrief_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  week_label TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_debrief_history_user_week
  ON weekly_debrief_history(user_id, week_start);

ALTER TABLE weekly_debrief_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weekly_debrief_history' AND policyname = 'Users can view own debriefs'
  ) THEN
    CREATE POLICY "Users can view own debriefs" ON weekly_debrief_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weekly_debrief_history' AND policyname = 'Users can insert own debriefs'
  ) THEN
    CREATE POLICY "Users can insert own debriefs" ON weekly_debrief_history
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weekly_debrief_history' AND policyname = 'Users can update own debriefs'
  ) THEN
    CREATE POLICY "Users can update own debriefs" ON weekly_debrief_history
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ✅ Done — all 10 migrations applied
