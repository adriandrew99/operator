-- Migration 00010: Client Monthly Overrides
-- Allows per-client monthly amount overrides (e.g., client pays 500 this month but 1000 next)

CREATE TABLE IF NOT EXISTS public.client_monthly_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL, -- 'YYYY-MM' format (e.g., '2025-06')
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
