import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FileDetailsPanel } from "./components/dashboard/FileDetailsPanel";
import { FilesTable } from "./components/dashboard/FilesTable";
import UploadPanel from "./components/dashboard/UploadPanel";
import AppLayout from "./components/layout/AppLayout";
import Footer from "./components/layout/Footer";
import Header from "./components/layout/Header";
import Text from "./components/ui/Text";
import { TaskFlowProvider, useTaskFlowStore } from "./store/TaskFlowStore";
import "./styles.css";

function Dashboard() {
  const { actionError, actionSuccess, selectedFileId } = useTaskFlowStore();

  return (
    <AppLayout header={<Header />} footer={<Footer />}>
      <UploadPanel />
      {actionSuccess && (
        <Text variant="success" role="status">
          {actionSuccess}
        </Text>
      )}
      {actionError && (
        <Text variant="error" role="alert">
          {actionError}
        </Text>
      )}
      {selectedFileId && <FileDetailsPanel />}
      <FilesTable />
    </AppLayout>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TaskFlowProvider>
      <Dashboard />
    </TaskFlowProvider>
  </StrictMode>,
);
