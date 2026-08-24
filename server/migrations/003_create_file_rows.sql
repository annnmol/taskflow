CREATE TABLE IF NOT EXISTS file_rows (
  id UUID PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT file_rows_file_id_row_number_key UNIQUE (file_id, row_number)
);

CREATE INDEX IF NOT EXISTS file_rows_file_id_idx ON file_rows (file_id);
