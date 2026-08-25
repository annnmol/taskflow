import type { FileStatus } from "../../types/files";

function StatusBadge({ status }: { status: FileStatus }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>{status}</span>
  );
}

export default StatusBadge;
