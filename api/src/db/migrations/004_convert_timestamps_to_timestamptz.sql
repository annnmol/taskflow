DO $$
DECLARE
  timestamp_column RECORD;
BEGIN
  FOR timestamp_column IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (
        ('files', 'created_at'),
        ('files', 'updated_at'),
        ('jobs', 'started_at'),
        ('jobs', 'completed_at'),
        ('jobs', 'created_at'),
        ('jobs', 'updated_at'),
        ('file_rows', 'created_at')
      )
      AND data_type = 'timestamp without time zone'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
      timestamp_column.table_name,
      timestamp_column.column_name,
      timestamp_column.column_name
    );
  END LOOP;
END $$;
