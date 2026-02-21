-- 00019: Operator Score overhaul — self-assessment check-in + versioning

-- Add self-assessment check-in data
ALTER TABLE public.operator_scores
  ADD COLUMN IF NOT EXISTS check_in JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- New rows default to version 2
ALTER TABLE public.operator_scores
  ALTER COLUMN version SET DEFAULT 2;

-- Index for fast "has checked in today?" lookups
CREATE INDEX IF NOT EXISTS idx_operator_scores_checkin
  ON public.operator_scores(user_id, date DESC)
  WHERE check_in IS NOT NULL;

COMMENT ON COLUMN public.operator_scores.check_in IS
  'Self-assessment ratings: {focus: 1-5, energy: 1-5, decisions: 1-5}';
COMMENT ON COLUMN public.operator_scores.version IS
  '1 = legacy auto-only score, 2 = new blended auto+self score';
