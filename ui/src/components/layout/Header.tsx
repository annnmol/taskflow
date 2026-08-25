import Button from "../ui/Button";
import Text from "../ui/Text";
import { useTaskFlowStore } from "../../store/TaskFlowStore";

function Header() {
  const { isFilesLoading, refreshFiles } = useTaskFlowStore();

  return (
    <header className="page-header">
      <div>
        <h1>TaskFlow</h1>
        <Text variant="eyebrow">
          Distributed Background Job Processing
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
