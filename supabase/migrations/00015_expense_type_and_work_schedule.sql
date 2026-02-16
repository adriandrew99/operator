-- Personal/business expense split
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'business';

-- Work schedule settings on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_start_hour INTEGER DEFAULT 9;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_end_hour INTEGER DEFAULT 17;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_days INTEGER[] DEFAULT '{1,2,3,4,5}';

-- Personal finance fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_cost NUMERIC DEFAULT 0;
