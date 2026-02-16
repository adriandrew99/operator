-- Migration 00008: Add urgent flag and scheduling columns to tasks
-- Run this in Supabase SQL Editor

-- Add urgent flag for priority marking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;

-- Add scheduling columns for the weekly calendar planner
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_time_block TEXT;

-- Add check constraint for time block values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_scheduled_time_block_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_scheduled_time_block_check CHECK (
      scheduled_time_block IS NULL OR scheduled_time_block IN (
        'early_morning',
        'morning',
        'late_morning',
        'afternoon',
        'late_afternoon',
        'evening',
        'night'
      )
    );
  END IF;
END
$$;

-- Calendar events table for fixed commitments (gym, meetings, etc.)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'fixed' CHECK (event_type IN ('fixed', 'deep_work', 'admin', 'break')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_days INTEGER[] DEFAULT NULL, -- array of day-of-week (0=Sun, 1=Mon, etc.)
  color TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for calendar events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calendar_events' AND policyname = 'Users can manage own calendar events'
  ) THEN
    CREATE POLICY "Users can manage own calendar events"
      ON calendar_events FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Client termination tracking columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_ending BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notice_period_months INTEGER DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS termination_date DATE DEFAULT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_urgent ON tasks(user_id, is_urgent) WHERE is_urgent = true;
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(user_id, scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, date);
