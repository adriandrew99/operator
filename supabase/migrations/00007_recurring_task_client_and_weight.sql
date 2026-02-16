-- ============================================================
-- Add client_id and weight to recurring_tasks
-- Allows recurring tasks to be tagged to specific clients
-- and have a mental weight for energy calculations
-- ============================================================

ALTER TABLE public.recurring_tasks
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight TEXT DEFAULT 'medium' CHECK (weight IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS energy TEXT DEFAULT 'admin' CHECK (energy IN ('deep', 'admin', 'creative')),
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
