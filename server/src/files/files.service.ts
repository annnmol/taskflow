import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JobsRepository } from '../jobs/jobs.repository';
import { FileStatus, FilesRepository } from './files.repository';

import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { RowsRepository } from './rows.repository';

@Injectable()
export class FilesService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly jobsRepository: JobsRepository,
    private readonly rowsRepository: RowsRepository,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
  ) {}

  async listFiles() {
    return this.filesRepository.listFiles();
  }

  async createFile(input: { name: string; contentType: string; size: number }) {
    const id = randomUUID();

    const storedPath = `uploads/${id}/${input.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    )}`;

    const file = await this.filesRepository.createFile({
      id,
      name: input.name,
      storedPath,
      mimeType: input.contentType,
      sizeBytes: input.size,
    });

    const uploadUrl = await this.storageService.createUploadUrl(
      storedPath,
      input.contentType,
      input.size,
    );

    return {
      fileId: file.id,
      file,
      uploadUrl,
    };
  }

  async getFileDetails(fileId: string) {
    const file = await this.filesRepository.getFileDetails(fileId);

    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }

    const job = await this.jobsRepository.findLatestJobByFileId(fileId);

    return {
      ...file,
      job: job ? this.jobsRepository.toJobSummary(job) : null,
    };
  }

  async createDownloadUrl(fileId: string) {
    const file = await this.filesRepository.findStoredFile(fileId);

    if (!file) {
      return {
        ok: false as const,
        status: 404,
        code: 'FILE_NOT_FOUND' as const,
        message: 'File not found.',
      };
    }

    if (!file.stored_path) {
      return {
        ok: false as const,
        status: 404,
        code: 'INVALID_FILE' as const,
        message: 'File has no stored object.',
      };
    }

    const downloadUrl = await this.storageService.createDownloadUrl(
      file.stored_path,
    );

    return {
      ok: true as const,
      body: {
        downloadUrl,
      },
    };
  }

  async listRows(fileId: string, page: number, pageSize: number) {
    const file = await this.filesRepository.findStoredFile(fileId);

    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }

    return this.rowsRepository.listRows(fileId, page, pageSize);
  }

  async queueFileForProcessing(fileId: string) {
    const file = await this.filesRepository.findStoredFile(fileId);

    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }

    if (!file.stored_path) {
      throw new ConflictException({
        code: 'INVALID_FILE',
        message: 'File has no stored object. Upload the CSV before queuing.',
      });
    }

    if (
      file.status !== FileStatus.FAILED &&
      file.status !== FileStatus.UPLOADED
    ) {
      throw new ConflictException({
        code: 'JOB_NOT_RETRYABLE',
        message: 'File is already queued or processing.',
      });
    }

    const jobId = randomUUID();

    const job = await this.jobsRepository.createJob({
      id: jobId,
      fileId: file.id,
    });

    const streamMessageId = await this.redisService.publishJob({
      jobId: job.id,
      fileId: file.id,
      type: 'CSV_PROCESS',
    });

    await this.filesRepository.updateFileStatus(file.id, FileStatus.QUEUED);

    return {
      fileId: file.id,
      jobId: job.id,
      status: job.status,
      stream: 'taskflow:jobs',
      streamMessageId,
    };
  }
}
