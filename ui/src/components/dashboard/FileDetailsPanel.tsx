import { memo, type ReactNode } from "react";
import { useTaskFlowStore } from "../../store/TaskFlowStore";
import type { FileDetails, FileRow } from "../../types/files";
import Button from "../ui/Button";
import Drawer from "../ui/Drawer";
import StatusBadge from "../ui/StatusBadge";
import Text from "../ui/Text";

const inFlightStatuses = new Set(["QUEUED", "PROCESSING", "RETRY_WAITING"]);

function formatFileSize(size: number | null) {
  if (size === null) return "Unknown";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function EmptyRows({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state compact">
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export const FileDetailsDrawer = memo(function FileDetailsDrawer() {
  const {
    fileDetails: file,
    selectedFileRows: rows,
    rowsTotal,
    rowsPage,
    isDetailsLoading,
    isRowsLoading,
    isDownloading,
    retryingFileId,
    detailsError,
    rowsError,
    closeFileDetails,
    downloadSelectedFile,
    retryFile,
    setRowsPage,
  } = useTaskFlowStore();
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row.data))),
  );
  const totalPages = Math.max(1, Math.ceil(rowsTotal / 10));
  const isProcessing = file ? inFlightStatuses.has(file.status) : false;

  return (
    <Drawer
      title="File details"
      onClose={closeFileDetails}
      actions={
        <div className="actions">
          <Button
            type="button"
            onClick={() => void downloadSelectedFile()}
            disabled={isDownloading || !file}
          >
            {isDownloading ? "Preparing..." : "Download CSV"}
          </Button>
          {file?.status === "FAILED" && file.job && (
            <Button
              type="button"
              onClick={() => void retryFile(file, file.job?.id)}
              disabled={retryingFileId === file.id}
            >
              {retryingFileId === file.id ? "Retrying..." : "Retry job"}
            </Button>
          )}
        </div>
      }
    >
      {isDetailsLoading && !file ? (
        <Text variant="muted">Loading file details...</Text>
      ) : detailsError ? (
        <Text variant="error" role="alert">
          {detailsError}
        </Text>
      ) : (
        file && (
          <>
            <dl className="details-grid details-grid-compact">
              <Detail label="Filename">{file.name}</Detail>
              <Detail label="Status">
                <StatusBadge status={file.status} />
              </Detail>
              <Detail label="File size">{formatFileSize(file.size)}</Detail>
              <Detail label="Rows">
                {file.status === "COMPLETED"
                  ? rowsTotal
                  : isProcessing
                    ? "Processing..."
                    : "—"}
              </Detail>
              <Detail label="Created time">
                {new Date(file.createdAt).toLocaleString()}
              </Detail>
              {file.job && (
                <Detail label="Job attempts">
                  {file.job.attempts}/{file.job.maxAttempts}
                </Detail>
              )}
              {file.job?.deadLetteredAt && (
                <Detail label="Dead-lettered">
                  {new Date(file.job.deadLetteredAt).toLocaleString()}
                </Detail>
              )}
            </dl>
            {isProcessing && (
              <Text variant="info" role="status">
                Processing in progress. This view refreshes automatically every
                few seconds.
              </Text>
            )}
            {file.status === "FAILED" && file.job?.errorMessage && (
              <Text variant="error" role="alert">
                Last error: {file.job.errorMessage}
              </Text>
            )}
            <RowsTable
              file={file}
              rows={rows}
              columns={columns}
              isLoading={isRowsLoading}
              error={rowsError}
            />
            {file.status === "COMPLETED" && (
              <div className="details-pagination">
                <span>
                  Page {rowsPage} of {totalPages} ({rowsTotal} rows)
                </span>
                <div className="actions">
                  <Button
                    type="button"
                    onClick={() => setRowsPage(Math.max(1, rowsPage - 1))}
                    disabled={rowsPage === 1 || isRowsLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      setRowsPage(Math.min(totalPages, rowsPage + 1))
                    }
                    disabled={rowsPage >= totalPages || isRowsLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </Drawer>
  );
});

function RowsTable({
  file,
  rows,
  columns,
  isLoading,
  error,
}: {
  file: FileDetails;
  rows: FileRow[];
  columns: string[];
  isLoading: boolean;
  error: string;
}) {
  const colSpan = Math.max(1, columns.length + 1);
  return (
    <div className="table-wrapper csv-table-wrapper">
      <table className="csv-table">
        <thead>
          <tr>
            <th>Row</th>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {file.status !== "COMPLETED" ? (
            <tr>
              <td colSpan={colSpan}>
                <EmptyRows
                  title="Rows not ready yet"
                  copy="Parsed data appears here after processing completes."
                />
              </td>
            </tr>
          ) : isLoading ? (
            <tr className="loading-row">
              <td colSpan={colSpan}>Loading rows...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={colSpan}>{error}</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan}>
                <EmptyRows
                  title="No rows found"
                  copy="This file completed but no parsed rows were stored."
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.rowNumber}</td>
                {columns.map((column) => (
                  <td key={column}>{row.data[column] ?? ""}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
