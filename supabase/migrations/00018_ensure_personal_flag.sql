-- 00018: Ensure is_personal column exists on tasks
-- This is idempotent — safe to re-run if migration 00014 already applied

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
