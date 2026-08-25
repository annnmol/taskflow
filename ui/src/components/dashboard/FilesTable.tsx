import { memo } from "react";
import Button from "../ui/Button";
import Panel from "../ui/Panel";
import StatusBadge from "../ui/StatusBadge";
import Text from "../ui/Text";
import { useTaskFlowStore } from "../../store/TaskFlowStore";

export const FilesTable = memo(function FilesTable() {
  const {
    files,
    isFilesLoading,
    filesError,
    retryingFileId,
    openFileDetails,
    retryFile,
  } = useTaskFlowStore();

  return (
    <Panel className="files-panel" aria-labelledby="files-heading">
      <div className="section-heading">
        <h2 id="files-heading">Your files</h2>
        <span className="file-count">{files.length} files</span>
      </div>

      {filesError && (
        <Text variant="error" role="alert">
          {filesError}
        </Text>
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
                  <EmptyFiles />
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id}>
                  <td>{file.name}</td>
                  <td>
                    <StatusBadge status={file.status} />
                  </td>
                  <td>{new Date(file.createdAt).toLocaleString()}</td>
                  <td className="actions">
                    <Button type="button" onClick={() => openFileDetails(file)}>
                      View
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void retryFile(file)}
                      disabled={
                        file.status !== "FAILED" || retryingFileId === file.id
                      }
                    >
                      {retryingFileId === file.id ? "Retrying..." : "Retry"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
});

function EmptyFiles() {
  return (
    <div className="empty-state">
      <strong>No files yet</strong>
      <span>Upload a CSV above to create your first processing job.</span>
    </div>
  );
}
