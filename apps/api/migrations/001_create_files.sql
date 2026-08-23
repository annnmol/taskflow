CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(1024),
  mime_type VARCHAR(255),
  size_bytes BIGINT,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS files_created_at_idx ON files (created_at);
CREATE INDEX IF NOT EXISTS files_status_idx ON files (status);
