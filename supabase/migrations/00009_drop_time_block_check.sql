-- Migration 00009: Drop time block check constraint
-- Now storing exact hour numbers (6-21) instead of named time blocks
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_scheduled_time_block_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_scheduled_time_block_check;
  END IF;
END
$$;

-- Clear any old enum-style values so they don't cause confusion
UPDATE tasks SET scheduled_time_block = NULL WHERE scheduled_time_block IS NOT NULL AND scheduled_time_block !~ '^\d+$';
