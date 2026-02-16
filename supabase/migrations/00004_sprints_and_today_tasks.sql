-- Migration 00004: Sprints table + flagged_for_today on tasks
-- Run this in Supabase SQL Editor

-- Sprints table for tracking big goals/projects with timelines
CREATE TABLE IF NOT EXISTS sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('client', 'personal')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date DATE,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue_value NUMERIC(12,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for sprints
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sprints' AND policyname = 'Users can manage own sprints'
  ) THEN
    CREATE POLICY "Users can manage own sprints"
      ON sprints FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Add sprint_id to tasks so tasks can be linked to sprints
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;

-- Add flagged_for_today to tasks for manual daily flagging
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS flagged_for_today BOOLEAN DEFAULT FALSE;

-- Index for fast sprint lookups
CREATE INDEX IF NOT EXISTS idx_sprints_user_status ON sprints(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_flagged_today ON tasks(user_id, flagged_for_today) WHERE flagged_for_today = true;
