-- Add daily MLU capacity setting to profiles
-- NULL means use the system default (20 MLU)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_mlu_capacity INTEGER DEFAULT NULL;
