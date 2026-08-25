import Button from "../ui/Button";
import Text from "../ui/Text";
import { useTaskFlowStore } from "../../store/TaskFlowStore";

function Header() {
  const { isFilesLoading, refreshFiles } = useTaskFlowStore();

  return (
    <header className="page-header">
      <div>
        <Text variant="eyebrow">TaskFlow</Text>
        <h1>Files Dashboard</h1>
        <Text variant="muted">
          Upload CSV files and track async background processing.
        </Text>
      </div>
      <Button
        type="button"
        onClick={() => void refreshFiles()}
        disabled={isFilesLoading}
      >
        {isFilesLoading ? "Refreshing..." : "Refresh files"}
      </Button>
    </header>
  );
}

export default Header;
