import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FormEvent } from "react";
import "./styles.css";

type FileStatus =
  | "UPLOADED"
  | "QUEUED"
  | "RETRY_WAITING"
  | "COMPLETED"
  | "PROCESSING"
  | "FAILED";

type JobSummary = {
  id: string;
  status: FileStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  deadLetteredAt: string | null;
};

type TaskFile = {
  id: string;
  name: string;
  status: FileStatus;
  createdAt: string;
};

type FileDetails = TaskFile & {
  size: number | null;
  job: JobSummary | null;
};

type FileRow = {
  id: string;
  rowNumber: number;
  data: Record<string, string>;
  createdAt: string;
};

type CreateFileResponse = {
  file: TaskFile;
  uploadUrl: string;
};

type FileRowsResponse = {
  rows: FileRow[];
  total: number;
  page: number;
  pageSize: number;
};

type ApiErrorPayload = {
  message?: string | string[];
  error?: string | { code?: string; message?: string };
};

type ApiSuccessPayload<T> = {
  data: T;
};

const rowsPageSize = 10;
const listPollMs = 5000;
const detailsPollMs = 3000;

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiUrl = (path: string) => `${apiBaseUrl}${path}`;

const inFlightStatuses = new Set<FileStatus>(["QUEUED", "PROCESSING", "RETRY_WAITING"]);

const readApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json() as ApiErrorPayload;
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message.join(" ");
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
    if (
      payload.error &&
      typeof payload.error === "object" &&
      typeof payload.error.message === "string" &&
      payload.error.message.trim()
    ) {
      return payload.error.message;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const readApiData = async <T,>(response: Response): Promise<T> => {
  // Nest success responses use { message, status, data }; retain raw-response support
  // for endpoints that intentionally bypass the global interceptor.
  const payload = await response.json() as T | ApiSuccessPayload<T>;
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return payload.data;
  }
  return payload;
};

const formatFileSize = (size: number | null): string => {
  if (size === null) {
    return "Unknown";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function App() {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [selectedUpload, setSelectedUpload] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryingFileId, setRetryingFileId] = useState<string | null>(null);

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [selectedFileRows, setSelectedFileRows] = useState<FileRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsPage, setRowsPage] = useState(1);
  const [isRowsLoading, setIsRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const loadFiles = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsFilesLoading(true);
    }
    try {
      const response = await fetch(apiUrl("/api/files"));
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Unable to load files."));
      }
      const payload = await readApiData<TaskFile[]>(response);
      setFiles(payload);
      setFilesError("");
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : "Unable to load files.");
    } finally {
      if (showLoading) {
        setIsFilesLoading(false);
      }
    }
  }, []);

  const loadFileDetails = useCallback(async (fileId: string, showLoading = false) => {
    if (showLoading) {
      setIsDetailsLoading(true);
    }
    try {
      const response = await fetch(apiUrl(`/api/files/${fileId}`));
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Unable to load file details."));
      }
      const payload = await readApiData<FileDetails>(response);
      setFileDetails(payload);
      setDetailsError("");
      setFiles((current) =>
        current.map((file) =>
          file.id === fileId
            ? { id: payload.id, name: payload.name, status: payload.status, createdAt: payload.createdAt }
            : file
        )
      );
      return payload;
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "Unable to load file details.");
      return null;
    } finally {
      if (showLoading) {
        setIsDetailsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadFiles(true);
    const interval = window.setInterval(() => {
      void loadFiles();
    }, listPollMs);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadFiles]);

  useEffect(() => {
    if (!selectedFileId) {
      setFileDetails(null);
      setDetailsError("");
      return;
    }

    void loadFileDetails(selectedFileId, true);
    const interval = window.setInterval(() => {
      void loadFileDetails(selectedFileId);
    }, detailsPollMs);
    return () => {
      window.clearInterval(interval);
    };
  }, [selectedFileId, loadFileDetails]);

  useEffect(() => {
    const loadRows = async () => {
      if (!selectedFileId || !fileDetails || fileDetails.status !== "COMPLETED") {
        setSelectedFileRows([]);
        setRowsTotal(0);
        return;
      }

      setRowsError("");
      setIsRowsLoading(true);
      try {
        const response = await fetch(
          apiUrl(`/api/files/${selectedFileId}/rows?page=${rowsPage}&pageSize=${rowsPageSize}`)
        );
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, "Unable to load file rows."));
        }
        const payload = await readApiData<FileRowsResponse>(response);
        setSelectedFileRows(payload.rows);
        setRowsTotal(payload.total);
      } catch (error) {
        setRowsError(error instanceof Error ? error.message : "Unable to load file rows.");
      } finally {
        setIsRowsLoading(false);
      }
    };

    void loadRows();
  }, [selectedFileId, fileDetails?.status, rowsPage]);

  const createFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedUpload) {
      setActionError("Choose a CSV file before uploading.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");
    setActionSuccess("");
    try {
      const response = await fetch(apiUrl("/api/files"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedUpload.name,
          contentType: selectedUpload.type || "text/csv",
          size: selectedUpload.size
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Unable to create file."));
      }
      const { file: createdFile, uploadUrl } = await readApiData<CreateFileResponse>(response);

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": selectedUpload.type || "text/csv" },
        body: selectedUpload
      });
      if (!uploadResponse.ok) {
        throw new Error("Unable to upload file contents to storage.");
      }

      const queueResponse = await fetch(apiUrl(`/api/files/${createdFile.id}/queue`), {
        method: "POST"
      });
      if (!queueResponse.ok) {
        throw new Error(
          await readApiErrorMessage(queueResponse, "Unable to queue file for processing.")
        );
      }

      await loadFiles();
      setActionSuccess(`"${createdFile.name}" uploaded successfully. Job queued for processing.`);
      setSelectedUpload(null);
      form.reset();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to upload file.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryFile = async (file: TaskFile, jobId?: string | null) => {
    setRetryingFileId(file.id);
    setActionError("");
    setActionSuccess("");
    try {
      let targetJobId = jobId ?? null;
      if (!targetJobId && file.status === "FAILED") {
        const detailsResponse = await fetch(apiUrl(`/api/files/${file.id}`));
        if (detailsResponse.ok) {
          const details = await readApiData<FileDetails>(detailsResponse);
          targetJobId = details.job?.id ?? null;
        }
      }

      const response = await fetch(
        apiUrl(targetJobId ? `/api/jobs/${targetJobId}/retry` : `/api/files/${file.id}/queue`),
        { method: "POST" }
      );
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Unable to retry file."));
      }
      setActionSuccess(`Retry queued for "${file.name}".`);
      await loadFiles();
      if (selectedFileId === file.id) {
        await loadFileDetails(file.id, true);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to retry file.");
    } finally {
      setRetryingFileId(null);
    }
  };

  const downloadSelectedFile = async () => {
    if (!fileDetails) {
      return;
    }

    setIsDownloading(true);
    setActionError("");
    try {
      const response = await fetch(apiUrl(`/api/files/${fileDetails.id}/download`));
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Unable to get download URL."));
      }
      const payload = await readApiData<{ downloadUrl?: string }>(response);
      if (!payload.downloadUrl) {
        throw new Error("Download URL missing from API response.");
      }
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to download file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const openFileDetails = (file: TaskFile) => {
    setSelectedFileId(file.id);
    setRowsPage(1);
    setRowsError("");
  };

  const closeFileDetails = () => {
    setSelectedFileId(null);
    setFileDetails(null);
    setSelectedFileRows([]);
    setRowsTotal(0);
    setRowsPage(1);
    setRowsError("");
    setDetailsError("");
  };

  const rowColumns = Array.from(new Set(selectedFileRows.flatMap((row) => Object.keys(row.data))));
  const totalPages = Math.max(1, Math.ceil(rowsTotal / rowsPageSize));
  const isProcessing = fileDetails ? inFlightStatuses.has(fileDetails.status) : false;

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">TaskFlow</p>
          <h1>Files Dashboard</h1>
          <p className="muted">Upload CSV files and track async background processing.</p>
        </div>
        <button type="button" onClick={() => void loadFiles(true)} disabled={isFilesLoading}>
          {isFilesLoading ? "Refreshing..." : "Refresh files"}
        </button>
      </header>

      <form className="upload-panel" aria-labelledby="upload-heading" onSubmit={createFile}>
        <div className="upload-copy">
          <h2 id="upload-heading">Upload a CSV file</h2>
          <p className="muted">Files upload to S3-compatible storage and process asynchronously.</p>
        </div>
        <div className="upload-controls">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={isSubmitting}
            onChange={(event) => setSelectedUpload(event.target.files?.[0] ?? null)}
          />
          <button className="primary-button" type="submit" disabled={isSubmitting || !selectedUpload}>
            {isSubmitting ? "Uploading..." : "Upload CSV"}
          </button>
        </div>
      </form>

      {actionSuccess && (
        <p className="success-message" role="status">
          {actionSuccess}
        </p>
      )}

      {actionError && (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      )}

      <section className="files-panel" aria-labelledby="files-heading">
        <div className="section-heading">
          <h2 id="files-heading">Your files</h2>
          <span className="file-count">{files.length} files</span>
        </div>

        {filesError && (
          <p className="error-message" role="alert">
            {filesError}
          </p>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>File name</th>
                <th>Status</th>
                <th>Created date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isFilesLoading ? (
                <tr className="loading-row">
                  <td colSpan={4}>Loading files...</td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <strong>No files yet</strong>
                      <span>Upload a CSV above to create your first processing job.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id}>
                    <td>{file.name}</td>
                    <td>
                      <span className={`status status-${file.status.toLowerCase()}`}>{file.status}</span>
                    </td>
                    <td>{new Date(file.createdAt).toLocaleString()}</td>
                    <td className="actions">
                      <button type="button" onClick={() => openFileDetails(file)}>
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => void retryFile(file)}
                        disabled={file.status !== "FAILED" || retryingFileId === file.id}
                      >
                        {retryingFileId === file.id ? "Retrying..." : "Retry"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedFileId && (
        <section className="details-panel" aria-live="polite">
          <div className="section-heading">
            <h2>File details</h2>
            <div className="actions">
              <button type="button" onClick={downloadSelectedFile} disabled={isDownloading || !fileDetails}>
                {isDownloading ? "Preparing..." : "Download CSV"}
              </button>
              {fileDetails?.status === "FAILED" && fileDetails.job && (
                <button
                  type="button"
                  onClick={() => void retryFile(fileDetails, fileDetails.job?.id)}
                  disabled={retryingFileId === fileDetails.id}
                >
                  {retryingFileId === fileDetails.id ? "Retrying..." : "Retry job"}
                </button>
              )}
              <button type="button" onClick={closeFileDetails}>
                Close
              </button>
            </div>
          </div>

          {isDetailsLoading && !fileDetails ? (
            <p className="muted">Loading file details...</p>
          ) : detailsError ? (
            <p className="error-message" role="alert">
              {detailsError}
            </p>
          ) : fileDetails ? (
            <>
              <dl className="details-grid">
                <div>
                  <dt>Filename</dt>
                  <dd>{fileDetails.name}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`status status-${fileDetails.status.toLowerCase()}`}>
                      {fileDetails.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>{formatFileSize(fileDetails.size)}</dd>
                </div>
                <div>
                  <dt>Rows</dt>
                  <dd>{fileDetails.status === "COMPLETED" ? rowsTotal : isProcessing ? "Processing..." : "—"}</dd>
                </div>
                <div>
                  <dt>Created time</dt>
                  <dd>{new Date(fileDetails.createdAt).toLocaleString()}</dd>
                </div>
                {fileDetails.job && (
                  <div>
                    <dt>Job attempts</dt>
                    <dd>
                      {fileDetails.job.attempts}/{fileDetails.job.maxAttempts}
                    </dd>
                  </div>
                )}
                {fileDetails.job?.deadLetteredAt && (
                  <div>
                    <dt>Dead-lettered</dt>
                    <dd>{new Date(fileDetails.job.deadLetteredAt).toLocaleString()}</dd>
                  </div>
                )}
              </dl>

              {isProcessing && (
                <p className="info-message" role="status">
                  Processing in progress. This view refreshes automatically every few seconds.
                </p>
              )}

              {fileDetails.status === "FAILED" && fileDetails.job?.errorMessage && (
                <p className="error-message" role="alert">
                  Last error: {fileDetails.job.errorMessage}
                </p>
              )}

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      {rowColumns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fileDetails.status !== "COMPLETED" ? (
                      <tr>
                        <td colSpan={Math.max(1, rowColumns.length + 1)}>
                          <div className="empty-state compact">
                            <strong>Rows not ready yet</strong>
                            <span>Parsed data appears here after processing completes.</span>
                          </div>
                        </td>
                      </tr>
                    ) : isRowsLoading ? (
                      <tr className="loading-row">
                        <td colSpan={Math.max(1, rowColumns.length + 1)}>Loading rows...</td>
                      </tr>
                    ) : rowsError ? (
                      <tr>
                        <td colSpan={Math.max(1, rowColumns.length + 1)}>{rowsError}</td>
                      </tr>
                    ) : selectedFileRows.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(1, rowColumns.length + 1)}>
                          <div className="empty-state compact">
                            <strong>No rows found</strong>
                            <span>This file completed but no parsed rows were stored.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      selectedFileRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.rowNumber}</td>
                          {rowColumns.map((column) => (
                            <td key={column}>{row.data[column] ?? ""}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {fileDetails.status === "COMPLETED" && (
                <div className="details-pagination">
                  <span>
                    Page {rowsPage} of {totalPages} ({rowsTotal} rows)
                  </span>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => setRowsPage((current) => Math.max(1, current - 1))}
                      disabled={rowsPage === 1 || isRowsLoading}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setRowsPage((current) => Math.min(totalPages, current + 1))}
                      disabled={rowsPage >= totalPages || isRowsLoading}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
