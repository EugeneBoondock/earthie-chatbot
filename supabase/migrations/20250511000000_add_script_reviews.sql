-- Add review fields to Earthie_scripts table
ALTER TABLE public."Earthie_scripts"
ADD COLUMN IF NOT EXISTS review_method TEXT,
ADD COLUMN IF NOT EXISTS review_by TEXT,
ADD COLUMN IF NOT EXISTS review_comment TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
