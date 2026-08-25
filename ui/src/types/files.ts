export type FileStatus =
  | "UPLOADED"
  | "QUEUED"
  | "RETRY_WAITING"
  | "COMPLETED"
  | "PROCESSING"
  | "FAILED";

export type JobSummary = {
  id: string;
  status: FileStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  deadLetteredAt: string | null;
};

export type TaskFile = {
  id: string;
  name: string;
  status: FileStatus;
  createdAt: string;
};

export type FileDetails = TaskFile & {
  size: number | null;
  job: JobSummary | null;
};

export type FileRow = {
  id: string;
  rowNumber: number;
  data: Record<string, string>;
  createdAt: string;
};

export type CreateFileResponse = {
  file: TaskFile;
  uploadUrl: string;
};

export type FileRowsResponse = {
  rows: FileRow[];
  total: number;
  page: number;
  pageSize: number;
};
