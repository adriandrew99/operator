-- ============================================================
-- Fix recurring_tasks category constraint to include 'admin'
-- The tasks table was updated in migration 00003 but
-- recurring_tasks was missed, causing insert failures
-- ============================================================

ALTER TABLE public.recurring_tasks DROP CONSTRAINT IF EXISTS recurring_tasks_category_check;
ALTER TABLE public.recurring_tasks ADD CONSTRAINT recurring_tasks_category_check
  CHECK (category IN ('strategy', 'clients', 'content', 'personal', 'admin'));
