-- Migration 00025: Month-specific expense overrides
-- Allows overriding staff_cost and/or salary for specific forecast months
-- e.g. "no staff costs in Feb, they start in March"

CREATE TABLE IF NOT EXISTS public.expense_monthly_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,               -- 'YYYY-MM' format
  staff_cost NUMERIC(12,2),          -- NULL = use profile default
  salary NUMERIC(12,2),              -- NULL = use profile default
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.expense_monthly_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expense_monthly_overrides'
    AND policyname = 'Users can manage their own expense overrides'
  ) THEN
    CREATE POLICY "Users can manage their own expense overrides"
      ON public.expense_monthly_overrides
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;
