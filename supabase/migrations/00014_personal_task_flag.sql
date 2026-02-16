-- Add personal flag to tasks — personal tasks don't contribute to MLU/client calculations
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
