-- Add probability field to pipeline_leads for weighted revenue projections
ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT NULL;
