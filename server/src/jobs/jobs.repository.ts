import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export enum JobStatus {
  QUEUED = 'QUEUED',
  RETRY_WAITING = 'RETRY_WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export type TaskJob = {
  id: string;
  file_id: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  dead_lettered_at: Date | string | null;
  created_at: Date | string;
};

export type JobSummary = {
  id: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  deadLetteredAt: string | null;
};

@Injectable()
export class JobsRepository {
  constructor(private readonly dbService: DbService) {}

  async createJob(input: { id: string; fileId: string }): Promise<TaskJob> {
    const result = await this.dbService.query<TaskJob>(
      `INSERT INTO jobs
          (id, file_id, status)
         VALUES
          ($1, $2, $3)
         RETURNING
          id,
          file_id,
          status,
          attempts,
          max_attempts,
          error_message,
          dead_lettered_at,
          created_at`,
      [input.id, input.fileId, JobStatus.QUEUED],
    );

    return result.rows[0];
  }

  async findJob(id: string): Promise<TaskJob | null> {
    const result = await this.dbService.query<TaskJob>(
      `SELECT
           id,
           file_id,
           status,
           attempts,
           max_attempts,
           error_message,
           dead_lettered_at,
           created_at
         FROM jobs
         WHERE id = $1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async findLatestJobByFileId(fileId: string): Promise<TaskJob | null> {
    const result = await this.dbService.query<TaskJob>(
      `SELECT
           id,
           file_id,
           status,
           attempts,
           max_attempts,
           error_message,
           dead_lettered_at,
           created_at
         FROM jobs
         WHERE file_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
      [fileId],
    );

    return result.rows[0] ?? null;
  }

  async resetFailedJobForRetry(id: string): Promise<TaskJob | null> {
    const result = await this.dbService.query<TaskJob>(
      `UPDATE jobs
         SET
           status = $2,
           attempts = 0,
           error_message = NULL,
           started_at = NULL,
           completed_at = NULL,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = $3
         RETURNING
           id,
           file_id,
           status,
           attempts,
           max_attempts,
           error_message,
           dead_lettered_at,
           created_at`,
      [id, JobStatus.QUEUED, JobStatus.FAILED],
    );

    return result.rows[0] ?? null;
  }

  toJobSummary(job: TaskJob): JobSummary {
    return {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      errorMessage: job.error_message,
      deadLetteredAt: job.dead_lettered_at
        ? new Date(job.dead_lettered_at).toISOString()
        : null,
    };
  }
}
