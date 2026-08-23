import { pool } from "../db.js";

export type FileStatus = "UPLOADED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

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

const toTaskFile = (file: StoredFile): TaskFile => ({
  id: file.id,
  name: file.original_name,
  status: file.status,
  createdAt: new Date(file.created_at).toISOString()
});

const toFileDetails = (file: StoredFile): FileDetails => ({
  id: file.id,
  name: file.original_name,
  status: file.status,
  size: file.size_bytes ? Number(file.size_bytes) : null,
  createdAt: new Date(file.created_at).toISOString()
});

export const listFiles = async (): Promise<TaskFile[]> => {
  const result = await pool.query<StoredFile>(
    `SELECT id, original_name, status, created_at
     FROM files
     ORDER BY created_at DESC`
  );
  return result.rows.map(toTaskFile);
};

export const createFile = async (input: {
  id: string;
  name: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<TaskFile> => {
  const result = await pool.query<StoredFile>(
    `INSERT INTO files (id, original_name, stored_path, mime_type, size_bytes, status)
     VALUES ($1, $2, $3, $4, $5, 'UPLOADED')
     RETURNING id, original_name, status, created_at`,
    [input.id, input.name, input.storedPath, input.mimeType, input.sizeBytes]
  );
  return toTaskFile(result.rows[0]);
};

export const findStoredFile = async (id: string): Promise<StoredFile | null> => {
  const result = await pool.query<StoredFile>(
    `SELECT id, original_name, stored_path, mime_type, size_bytes, status, created_at
     FROM files
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const getFileDetails = async (id: string): Promise<FileDetails | null> => {
  const file = await findStoredFile(id);
  return file ? toFileDetails(file) : null;
};

export const updateFileStatus = async (id: string, status: FileStatus): Promise<void> => {
  await pool.query(
    `UPDATE files
     SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, status]
  );
};
