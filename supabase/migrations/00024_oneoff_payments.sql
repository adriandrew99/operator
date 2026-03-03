-- Migration 00024: One-off Payments
-- Allows adding confirmed one-time income for specific months (e.g., freelance invoices, ad-hoc projects)

CREATE TABLE IF NOT EXISTS public.oneoff_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  month TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.oneoff_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'oneoff_payments'
    AND policyname = 'Users can manage their own oneoff payments'
  ) THEN
    CREATE POLICY "Users can manage their own oneoff payments"
      ON public.oneoff_payments
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;
