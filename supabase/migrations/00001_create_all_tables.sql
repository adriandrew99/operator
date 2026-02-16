-- ============================================================
-- OPERATOR OS - Complete Database Schema
-- ============================================================

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  accent_color TEXT DEFAULT 'green',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. DAILY OBJECTIVES
CREATE TABLE public.daily_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  primary_objective TEXT,
  secondary_task_1 TEXT,
  secondary_task_2 TEXT,
  secondary_task_3 TEXT,
  primary_completed BOOLEAN DEFAULT false,
  secondary_1_completed BOOLEAN DEFAULT false,
  secondary_2_completed BOOLEAN DEFAULT false,
  secondary_3_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_objectives_user_date ON public.daily_objectives(user_id, date DESC);

-- 3. FUNDAMENTALS
CREATE TABLE public.fundamentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  gym BOOLEAN DEFAULT false,
  deep_work_90 BOOLEAN DEFAULT false,
  steps_8k BOOLEAN DEFAULT false,
  no_alcohol BOOLEAN DEFAULT false,
  sleep_7h BOOLEAN DEFAULT false,
  meaningful_social BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_fundamentals_user_date ON public.fundamentals(user_id, date DESC);

-- 4. DEEP WORK SESSIONS
CREATE TABLE public.deep_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deep_work_user_date ON public.deep_work_sessions(user_id, date DESC);

-- 5. OPERATOR SCORES
CREATE TABLE public.operator_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  breakdown JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_operator_scores_user_date ON public.operator_scores(user_id, date DESC);

-- 6. TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('strategy', 'clients', 'content', 'personal')),
  energy TEXT NOT NULL DEFAULT 'admin' CHECK (energy IN ('deep', 'admin', 'creative')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  deadline DATE,
  estimated_minutes INTEGER,
  is_high_impact BOOLEAN DEFAULT false,
  is_revenue_generating BOOLEAN DEFAULT false,
  is_low_energy BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_user_category ON public.tasks(user_id, category);
CREATE INDEX idx_tasks_user_deadline ON public.tasks(user_id, deadline);

-- 7. CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  retainer_amount NUMERIC(10,2),
  payment_day INTEGER CHECK (payment_day >= 1 AND payment_day <= 31),
  contract_start DATE,
  contract_end DATE,
  contract_length_months INTEGER,
  renewal_probability INTEGER CHECK (renewal_probability >= 0 AND renewal_probability <= 100),
  risk_flag BOOLEAN DEFAULT false,
  risk_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_user_active ON public.clients(user_id, is_active);

-- 8. EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('software', 'hosting', 'marketing', 'office', 'travel', 'professional', 'insurance', 'subscriptions', 'other')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX idx_expenses_user_category ON public.expenses(user_id, category);

-- 9. FINANCIAL SNAPSHOTS
CREATE TABLE public.financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_expenses NUMERIC(12,2) DEFAULT 0,
  corp_tax_reserve NUMERIC(12,2) DEFAULT 0,
  dividend_paid NUMERIC(12,2) DEFAULT 0,
  net_worth NUMERIC(14,2),
  isa_balance NUMERIC(12,2) DEFAULT 0,
  house_deposit_balance NUMERIC(12,2) DEFAULT 0,
  house_deposit_target NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

CREATE INDEX idx_financial_snapshots_user_month ON public.financial_snapshots(user_id, month DESC);

-- 10. PIPELINE LEADS
CREATE TABLE public.pipeline_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  estimated_value NUMERIC(10,2),
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'conversation', 'proposal_sent', 'closed', 'lost')),
  next_action TEXT,
  next_action_date DATE,
  notes TEXT,
  source TEXT,
  lost_reason TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pipeline_user_stage ON public.pipeline_leads(user_id, stage);

-- 11. KNOWLEDGE ENTRIES
CREATE TABLE public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reading', 'idea', 'lesson', 'quote', 'mental_model', 'content_hook')),
  title TEXT NOT NULL,
  content TEXT,
  reading_status TEXT CHECK (reading_status IN ('to_read', 'reading', 'completed')),
  takeaway_1 TEXT,
  takeaway_2 TEXT,
  takeaway_3 TEXT,
  applied BOOLEAN DEFAULT false,
  source TEXT,
  hook_platform TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_user_type ON public.knowledge_entries(user_id, type);

-- 12. WEEKLY REVIEWS
CREATE TABLE public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  revenue_reflection TEXT,
  deep_work_reflection TEXT,
  training_reflection TEXT,
  drift_reflection TEXT,
  time_waste_reflection TEXT,
  meaning_reflection TEXT,
  focus_area_1 TEXT,
  focus_area_2 TEXT,
  focus_area_3 TEXT,
  total_operator_score_avg INTEGER,
  total_deep_work_minutes INTEGER,
  total_fundamentals_hit INTEGER,
  revenue_this_week NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_reviews_user_week ON public.weekly_reviews(user_id, week_start DESC);

-- 13. IDENTITY GOALS
CREATE TABLE public.identity_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_value NUMERIC(12,2) NOT NULL,
  current_value NUMERIC(12,2) DEFAULT 0,
  unit TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'up',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_identity_goals_user ON public.identity_goals(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deep_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_goals ENABLE ROW LEVEL SECURITY;

-- Profiles (special: id = user id)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Macro for standard CRUD policies on user_id tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'daily_objectives', 'fundamentals', 'deep_work_sessions', 'operator_scores',
    'tasks', 'clients', 'expenses', 'financial_snapshots',
    'pipeline_leads', 'knowledge_entries', 'weekly_reviews', 'identity_goals'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "Users can view own %1$s" ON public.%1$s FOR SELECT USING (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "Users can insert own %1$s" ON public.%1$s FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "Users can update own %1$s" ON public.%1$s FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', tbl);
    EXECUTE format('CREATE POLICY "Users can delete own %1$s" ON public.%1$s FOR DELETE USING (auth.uid() = user_id)', tbl);
  END LOOP;
END $$;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_objectives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fundamentals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_scores;
