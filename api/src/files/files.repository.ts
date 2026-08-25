import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export enum FileStatus {
  UPLOADED = 'UPLOADED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export type TaskFile = {
  id: string;
  name: string;
  status: FileStatus;
  createdAt: string;
};

export type FileDetails = {
  id: string;
  name: string;
  status: FileStatus;
  size: number | null;
  createdAt: string;
};

export type StoredFile = {
  id: string;
  original_name: string;
  stored_path: string | null;
  mime_type: string | null;
  size_bytes: string | null;
  status: FileStatus;
  created_at: Date | string;
};

@Injectable()
export class FilesRepository {
  constructor(private readonly DbService: DbService) {}

  async listFiles(): Promise<TaskFile[]> {
    const result = await this.DbService.query<StoredFile>(
      `SELECT id, original_name, status, created_at
         FROM files
         ORDER BY created_at DESC`,
    );

    return result.rows.map((file) => this.toTaskFile(file));
  }

  async createFile(input: {
    id: string;
    name: string;
    storedPath: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<TaskFile> {
    const result = await this.DbService.query<StoredFile>(
      `INSERT INTO files
          (id, original_name, stored_path, mime_type, size_bytes, status)
         VALUES
          ($1, $2, $3, $4, $5, $6)
         RETURNING id, original_name, status, created_at`,
      [
        input.id,
        input.name,
        input.storedPath,
        input.mimeType,
        input.sizeBytes,
        FileStatus.UPLOADED,
      ],
    );

    return this.toTaskFile(result.rows[0]);
  }

  async findStoredFile(id: string): Promise<StoredFile | null> {
    const result = await this.DbService.query<StoredFile>(
      `SELECT
           id,
           original_name,
           stored_path,
           mime_type,
           size_bytes,
           status,
           created_at
         FROM files
         WHERE id = $1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async getFileDetails(id: string): Promise<FileDetails | null> {
    const file = await this.findStoredFile(id);

    return file ? this.toFileDetails(file) : null;
  }

  async updateFileStatus(id: string, status: FileStatus): Promise<void> {
    await this.DbService.query(
      `UPDATE files
       SET status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, status],
    );
  }

  private toTaskFile(file: StoredFile): TaskFile {
    return {
      id: file.id,
      name: file.original_name,
      status: file.status,
      createdAt: new Date(file.created_at).toISOString(),
    };
  }

  private toFileDetails(file: StoredFile): FileDetails {
    return {
      id: file.id,
      name: file.original_name,
      status: file.status,
      size: file.size_bytes ? Number(file.size_bytes) : null,
      createdAt: new Date(file.created_at).toISOString(),
    };
  }
}
