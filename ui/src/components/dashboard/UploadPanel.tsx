import Button from "../ui/Button";
import Panel from "../ui/Panel";
import Text from "../ui/Text";
import { useTaskFlowStore } from "../../store/TaskFlowStore";

function UploadPanel() {
  const { selectedUpload, isSubmitting, setSelectedUpload, uploadFile } =
    useTaskFlowStore();

  return (
    <Panel className="upload-panel" aria-labelledby="upload-heading">
      <form
        className="upload-form"
        onSubmit={(event) => void uploadFile(event)}
      >
        <div className="upload-copy">
          <h2 id="upload-heading">Upload a CSV file</h2>
          {/* <Text variant="muted">
         Files upload directly to S3 via presigned URLs and process asynchronously.
          </Text> */}
        </div>
        <div className="upload-controls">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={isSubmitting}
            onChange={(event) =>
              setSelectedUpload(event.target.files?.[0] ?? null)
            }
          />
          <Button
            variant="primary"
            type="submit"
            disabled={isSubmitting || !selectedUpload}
          >
            {isSubmitting ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export default UploadPanel;
