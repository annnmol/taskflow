import { pool } from "../db.js";

export type JobStatus = "QUEUED" | "RETRY_WAITING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type Job = {
  id: string;
  file_id: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
};

export type FailureState = {
  status: JobStatus;
  attempts: number;
  max_attempts: number;
};

export const findJob = async (id: string): Promise<Job | null> => {
  const result = await pool.query<Job>(
    `SELECT id, file_id, status, attempts, max_attempts, error_message
     FROM jobs
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const markJobProcessing = async (id: string): Promise<void> => {
  await pool.query(
    `UPDATE jobs
     SET status = 'PROCESSING',
         error_message = NULL,
         started_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
};

export const markJobCompleted = async (id: string): Promise<void> => {
  await pool.query(
    `UPDATE jobs
     SET status = 'COMPLETED',
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
};

export const markJobQueued = async (id: string): Promise<void> => {
  await pool.query(
    `UPDATE jobs
     SET status = 'QUEUED',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
};

export const recordJobFailure = async (
  id: string,
  errorMessage: string
): Promise<FailureState | null> => {
  const result = await pool.query<FailureState>(
    `UPDATE jobs
     SET attempts = attempts + 1,
         error_message = $2,
         status = CASE
           WHEN attempts + 1 >= max_attempts THEN 'FAILED'
           ELSE 'RETRY_WAITING'
         END,
         completed_at = CASE
           WHEN attempts + 1 >= max_attempts THEN CURRENT_TIMESTAMP
           ELSE completed_at
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND status = 'PROCESSING'
     RETURNING status, attempts, max_attempts`,
    [id, errorMessage]
  );

  return result.rows[0] ?? null;
};

export const markJobDeadLettered = async (id: string): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE jobs
     SET dead_lettered_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND status = 'FAILED'
       AND dead_lettered_at IS NULL`,
    [id]
  );

  return result.rowCount === 1;
};
