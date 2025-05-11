-- First, add the review fields to Earthie_scripts table
ALTER TABLE public."Earthie_scripts"
ADD COLUMN IF NOT EXISTS review_method TEXT,
ADD COLUMN IF NOT EXISTS review_by TEXT,
ADD COLUMN IF NOT EXISTS review_comment TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Then, add the metadata JSONB column for storing additional information
ALTER TABLE public."Earthie_scripts"
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Comment for future reference:
-- The metadata column can store arbitrary JSON data such as:
-- {
--   "review_badge": "Reviewed by Gemini",
--   "review_approved": true,
--   "submission_source": "web"
-- } 