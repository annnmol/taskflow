import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { FileStatus, FilesRepository } from '../files/files.repository';

import { RedisService } from '../redis/redis.service';

import { JobStatus, JobsRepository } from './jobs.repository';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly filesRepository: FilesRepository,
    private readonly redisService: RedisService,
  ) {}

  async retryJob(jobId: string) {
    // 1. Find the existing job
    const existingJob = await this.jobsRepository.findJob(jobId);

    if (!existingJob) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: 'Job not found.',
      });
    }

    // 2. Only FAILED jobs can be retried
    if (existingJob.status !== JobStatus.FAILED) {
      throw new ConflictException({
        code: 'JOB_NOT_RETRYABLE',
        message: 'Only failed jobs can be retried.',
      });
    }

    // 3. Find the file associated with the job
    const file = await this.filesRepository.findStoredFile(existingJob.file_id);

    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found for this job.',
      });
    }

    // 4. Make sure the actual CSV still exists in storage
    if (!file.stored_path) {
      throw new ConflictException({
        code: 'INVALID_FILE',
        message: 'File has no stored object.',
      });
    }

    // 5. Reset the failed job
    const job = await this.jobsRepository.resetFailedJobForRetry(
      existingJob.id,
    );

    // Another request may have changed the job
    // between step 1 and step 5.
    if (!job) {
      throw new ConflictException({
        code: 'JOB_NOT_RETRYABLE',
        message: 'Only failed jobs can be retried.',
      });
    }

    // 6. Put the job back into Redis Stream
    const streamMessageId = await this.redisService.publishJob({
      jobId: job.id,
      fileId: job.file_id,
      type: 'CSV_PROCESS',
    });

    // 7. Update file status
    await this.filesRepository.updateFileStatus(job.file_id, FileStatus.QUEUED);

    return {
      jobId: job.id,
      fileId: job.file_id,
      status: job.status,
      stream: 'taskflow:jobs',
      streamMessageId,
    };
  }

  async listDeadLetter(limit: number) {
    const entries = await this.redisService.listDeadLetterEntries(limit);

    return {
      stream: 'taskflow:dead-letter',
      entries,
    };
  }
}
