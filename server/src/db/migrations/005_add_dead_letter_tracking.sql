ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

UPDATE jobs
SET attempts = max_attempts
WHERE attempts > max_attempts;

UPDATE jobs
SET dead_lettered_at = COALESCE(completed_at, updated_at)
WHERE status = 'FAILED'
  AND dead_lettered_at IS NULL;
