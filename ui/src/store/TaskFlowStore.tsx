import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type FormEvent,
  type ReactNode,
} from "react";
import { apiService } from "../services/api.service";
import type { FileDetails, FileRow, TaskFile } from "../types/files";

const rowsPageSize = 10;
const listPollMs = 5000;
const detailsPollMs = 3000;

type TaskFlowState = {
  files: TaskFile[];
  isFilesLoading: boolean;
  filesError: string;
  actionError: string;
  actionSuccess: string;
  selectedUpload: File | null;
  isSubmitting: boolean;
  retryingFileId: string | null;
  selectedFileId: string | null;
  fileDetails: FileDetails | null;
  isDetailsLoading: boolean;
  detailsError: string;
  selectedFileRows: FileRow[];
  rowsTotal: number;
  rowsPage: number;
  isRowsLoading: boolean;
  rowsError: string;
  isDownloading: boolean;
};

type TaskFlowAction =
  | { type: "update"; payload: Partial<TaskFlowState> }
  | { type: "setFileDetails"; payload: FileDetails }
  | { type: "closeFileDetails" };

const initialState: TaskFlowState = {
  files: [],
  isFilesLoading: true,
  filesError: "",
  actionError: "",
  actionSuccess: "",
  selectedUpload: null,
  isSubmitting: false,
  retryingFileId: null,
  selectedFileId: null,
  fileDetails: null,
  isDetailsLoading: false,
  detailsError: "",
  selectedFileRows: [],
  rowsTotal: 0,
  rowsPage: 1,
  isRowsLoading: false,
  rowsError: "",
  isDownloading: false,
};

function taskFlowReducer(state: TaskFlowState, action: TaskFlowAction): TaskFlowState {
  switch (action.type) {
    case "update":
      return { ...state, ...action.payload };
    case "setFileDetails":
      return {
        ...state,
        fileDetails: action.payload,
        files: state.files.map((file) => file.id === action.payload.id ? {
          id: action.payload.id,
          name: action.payload.name,
          status: action.payload.status,
          createdAt: action.payload.createdAt,
        } : file),
      };
    case "closeFileDetails":
      return {
        ...state,
        selectedFileId: null,
        fileDetails: null,
        selectedFileRows: [],
        rowsTotal: 0,
        rowsPage: 1,
        rowsError: "",
        detailsError: "",
      };
  }
}

type TaskFlowContextValue = TaskFlowState & {
  refreshFiles: () => Promise<void>;
  setSelectedUpload: (file: File | null) => void;
  uploadFile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  openFileDetails: (file: TaskFile) => void;
  closeFileDetails: () => void;
  retryFile: (file: TaskFile, jobId?: string | null) => Promise<void>;
  downloadSelectedFile: () => Promise<void>;
  setRowsPage: (page: number) => void;
};

const TaskFlowContext = createContext<TaskFlowContextValue | null>(null);

export function TaskFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskFlowReducer, initialState);

  const loadFiles = useCallback(async (showLoading = false) => {
    if (showLoading) dispatch({ type: "update", payload: { isFilesLoading: true } });
    try {
      const files = await apiService.files.list();
      dispatch({ type: "update", payload: { files, filesError: "" } });
    } catch (error) {
      dispatch({ type: "update", payload: { filesError: error instanceof Error ? error.message : "Unable to load files." } });
    } finally {
      if (showLoading) dispatch({ type: "update", payload: { isFilesLoading: false } });
    }
  }, []);

  const loadFileDetails = useCallback(async (fileId: string, showLoading = false) => {
    if (showLoading) dispatch({ type: "update", payload: { isDetailsLoading: true } });
    try {
      const details = await apiService.files.get(fileId);
      dispatch({ type: "setFileDetails", payload: details });
      dispatch({ type: "update", payload: { detailsError: "" } });
    } catch (error) {
      dispatch({ type: "update", payload: { detailsError: error instanceof Error ? error.message : "Unable to load file details." } });
    } finally {
      if (showLoading) dispatch({ type: "update", payload: { isDetailsLoading: false } });
    }
  }, []);

  useEffect(() => {
    void loadFiles(true);
    const interval = window.setInterval(() => void loadFiles(), listPollMs);
    return () => window.clearInterval(interval);
  }, [loadFiles]);

  useEffect(() => {
    if (!state.selectedFileId) return;
    const fileId = state.selectedFileId;
    void loadFileDetails(fileId, true);
    const interval = window.setInterval(() => void loadFileDetails(fileId), detailsPollMs);
    return () => window.clearInterval(interval);
  }, [state.selectedFileId, loadFileDetails]);

  useEffect(() => {
    if (!state.selectedFileId || state.fileDetails?.status !== "COMPLETED") return;
    const loadRows = async () => {
      dispatch({ type: "update", payload: { rowsError: "", isRowsLoading: true } });
      try {
        const result = await apiService.files.rows(state.selectedFileId!, state.rowsPage, rowsPageSize);
        dispatch({ type: "update", payload: { selectedFileRows: result.rows, rowsTotal: result.total } });
      } catch (error) {
        dispatch({ type: "update", payload: { rowsError: error instanceof Error ? error.message : "Unable to load file rows." } });
      } finally {
        dispatch({ type: "update", payload: { isRowsLoading: false } });
      }
    };
    void loadRows();
  }, [state.selectedFileId, state.fileDetails?.status, state.rowsPage]);

  const uploadFile = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!state.selectedUpload) {
      dispatch({ type: "update", payload: { actionError: "Choose a CSV file before uploading." } });
      return;
    }
    dispatch({ type: "update", payload: { isSubmitting: true, actionError: "", actionSuccess: "" } });
    try {
      const { file, uploadUrl } = await apiService.files.create(state.selectedUpload);
      await apiService.files.upload(uploadUrl, state.selectedUpload);
      await apiService.files.queue(file.id);
      await loadFiles();
      dispatch({ type: "update", payload: { actionSuccess: `"${file.name}" uploaded successfully. Job queued for processing.`, selectedUpload: null } });
      form.reset();
    } catch (error) {
      dispatch({ type: "update", payload: { actionError: error instanceof Error ? error.message : "Unable to upload file." } });
    } finally {
      dispatch({ type: "update", payload: { isSubmitting: false } });
    }
  }, [loadFiles, state.selectedUpload]);

  const retryFile = useCallback(async (file: TaskFile, jobId?: string | null) => {
    dispatch({ type: "update", payload: { retryingFileId: file.id, actionError: "", actionSuccess: "" } });
    try {
      const targetJobId = jobId ?? (file.status === "FAILED" ? (await apiService.files.get(file.id)).job?.id : null);
      if (targetJobId) await apiService.jobs.retry(targetJobId);
      else await apiService.files.queue(file.id);
      dispatch({ type: "update", payload: { actionSuccess: `Retry queued for "${file.name}".` } });
      await loadFiles();
      if (state.selectedFileId === file.id) await loadFileDetails(file.id, true);
    } catch (error) {
      dispatch({ type: "update", payload: { actionError: error instanceof Error ? error.message : "Unable to retry file." } });
    } finally {
      dispatch({ type: "update", payload: { retryingFileId: null } });
    }
  }, [loadFileDetails, loadFiles, state.selectedFileId]);

  const downloadSelectedFile = useCallback(async () => {
    if (!state.fileDetails) return;
    dispatch({ type: "update", payload: { isDownloading: true, actionError: "" } });
    try {
      const { downloadUrl } = await apiService.files.download(state.fileDetails.id);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      dispatch({ type: "update", payload: { actionError: error instanceof Error ? error.message : "Unable to download file." } });
    } finally {
      dispatch({ type: "update", payload: { isDownloading: false } });
    }
  }, [state.fileDetails]);

  const value = useMemo<TaskFlowContextValue>(() => ({
    ...state,
    refreshFiles: () => loadFiles(true),
    setSelectedUpload: (selectedUpload) => dispatch({ type: "update", payload: { selectedUpload } }),
    uploadFile,
    openFileDetails: (file) => dispatch({ type: "update", payload: { selectedFileId: file.id, rowsPage: 1, rowsError: "" } }),
    closeFileDetails: () => dispatch({ type: "closeFileDetails" }),
    retryFile,
    downloadSelectedFile,
    setRowsPage: (rowsPage) => dispatch({ type: "update", payload: { rowsPage } }),
  }), [downloadSelectedFile, loadFiles, retryFile, state, uploadFile]);

  return <TaskFlowContext.Provider value={value}>{children}</TaskFlowContext.Provider>;
}

export function useTaskFlowStore() {
  const context = useContext(TaskFlowContext);
  if (!context) throw new Error("useTaskFlowStore must be used inside TaskFlowProvider.");
  return context;
}
