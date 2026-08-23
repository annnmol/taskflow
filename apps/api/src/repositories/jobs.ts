import { pool } from "../db.js";

export type JobStatus = "QUEUED" | "RETRY_WAITING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type TaskJob = {
  id: string;
  file_id: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: Date | string;
};

export type JobSummary = {
  id: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
};

export const toJobSummary = (job: TaskJob): JobSummary => ({
  id: job.id,
  status: job.status,
  attempts: job.attempts,
  maxAttempts: job.max_attempts,
  errorMessage: job.error_message
});

export const createJob = async (input: {
  id: string;
  fileId: string;
}): Promise<TaskJob> => {
  const result = await pool.query<TaskJob>(
    `INSERT INTO jobs (id, file_id, status)
     VALUES ($1, $2, 'QUEUED')
     RETURNING id, file_id, status, attempts, max_attempts, error_message, created_at`,
    [input.id, input.fileId]
  );
  return result.rows[0];
};

export const findJob = async (id: string): Promise<TaskJob | null> => {
  const result = await pool.query<TaskJob>(
    `SELECT id, file_id, status, attempts, max_attempts, error_message, created_at
     FROM jobs
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const findLatestJobByFileId = async (fileId: string): Promise<TaskJob | null> => {
  const result = await pool.query<TaskJob>(
    `SELECT id, file_id, status, attempts, max_attempts, error_message, created_at
     FROM jobs
     WHERE file_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [fileId]
  );
  return result.rows[0] ?? null;
};

export const resetFailedJobForRetry = async (id: string): Promise<TaskJob | null> => {
  const result = await pool.query<TaskJob>(
    `UPDATE jobs
     SET status = 'QUEUED',
         attempts = 0,
         error_message = NULL,
         started_at = NULL,
         completed_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'FAILED'
     RETURNING id, file_id, status, attempts, max_attempts, error_message, created_at`,
    [id]
  );
  return result.rows[0] ?? null;
};
