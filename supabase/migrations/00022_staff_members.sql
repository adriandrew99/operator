-- Staff members table — track individual staff/contractor costs
-- Replaces the single staff_cost field on profiles with granular per-person tracking

CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT, -- e.g. 'Admin', 'Outbound', 'VA', 'Operations'
  monthly_cost NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS policies
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own staff members"
  ON public.staff_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own staff members"
  ON public.staff_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own staff members"
  ON public.staff_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own staff members"
  ON public.staff_members FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_staff_members_user_id ON public.staff_members(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_active ON public.staff_members(user_id, is_active);
