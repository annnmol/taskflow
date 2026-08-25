import { http, uploadToUrl } from "../lib/http";
import type {
  CreateFileResponse,
  FileDetails,
  FileRowsResponse,
  TaskFile,
} from "../types/files";

const files = "/files";
const fileById = (fileId: string) => `${files}/${fileId}`;
const jobs = "/jobs";

export const apiService = {
  files: {
    list: () => http.get<TaskFile[]>(files),
    get: (fileId: string) => http.get<FileDetails>(fileById(fileId)),
    create: (file: File) =>
      http.post<CreateFileResponse>(files, {
        name: file.name,
        contentType: file.type || "text/csv",
        size: file.size,
      }),
    upload: (uploadUrl: string, file: File) => uploadToUrl(uploadUrl, file),
    queue: (fileId: string) => http.post<void>(`${fileById(fileId)}/queue`),
    download: (fileId: string) =>
      http.get<{ downloadUrl: string }>(`${fileById(fileId)}/download`),
    rows: (fileId: string, page: number, pageSize: number) =>
      http.get<FileRowsResponse>(`${fileById(fileId)}/rows`, {
        params: { page, pageSize },
      }),
  },
  jobs: {
    retry: (jobId: string) => http.post<void>(`${jobs}/${jobId}/retry`),
  },
};
