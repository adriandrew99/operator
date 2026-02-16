-- Migration: Rename task weights from simple/intensive to low/high
-- The 'medium' value stays the same

-- Update existing data
UPDATE public.tasks SET weight = 'low' WHERE weight = 'simple';
UPDATE public.tasks SET weight = 'high' WHERE weight = 'intensive';

-- Drop old constraint and add new one
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_weight_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_weight_check CHECK (weight IN ('low', 'medium', 'high'));
