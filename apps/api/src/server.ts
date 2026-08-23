import express from "express";
import { randomUUID } from "node:crypto";
import { initializeDatabase, pool } from "./db.js";
import {
  createFile,
  findStoredFile,
  getFileDetails,
  listFiles,
  updateFileStatus
} from "./repositories/files.js";
import {
  createJob,
  findJob,
  findLatestJobByFileId,
  resetFailedJobForRetry,
  toJobSummary
} from "./repositories/jobs.js";
import { listRows } from "./repositories/rows.js";
import {
  closeRedis,
  deadLetterStream,
  initializeRedis,
  listDeadLetterEntries,
  publishJob,
  redisClient
} from "./redis.js";
import { createDownloadUrl, createUploadUrl, initializeStorage } from "./storage.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

type ErrorCode =
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "FILE_NOT_FOUND"
  | "JOB_NOT_FOUND"
  | "JOB_NOT_RETRYABLE"
  | "PROCESSING_FAILED"
  | "INTERNAL_ERROR";

const sendError = (
  response: express.Response,
  status: number,
  code: ErrorCode,
  message: string
) => {
  response.status(status).json({
    error: {
      code,
      message
    }
  });
};

app.use(express.json());

const queueFileForProcessing = async (fileId: string) => {
  const file = await findStoredFile(fileId);
  if (!file) {
    return { ok: false as const, status: 404, code: "FILE_NOT_FOUND" as const, message: "File not found." };
  }
  if (!file.stored_path) {
    return {
      ok: false as const,
      status: 409,
      code: "INVALID_FILE" as const,
      message: "File has no stored object. Upload the CSV before queuing."
    };
  }
  if (file.status !== "FAILED" && file.status !== "UPLOADED") {
    return {
      ok: false as const,
      status: 409,
      code: "JOB_NOT_RETRYABLE" as const,
      message: "File is already queued or processing."
    };
  }

  const jobId = randomUUID();
  const job = await createJob({ id: jobId, fileId: file.id });
  const streamMessageId = await publishJob({
    jobId: job.id,
    fileId: file.id,
    type: "CSV_PROCESS"
  });
  await updateFileStatus(file.id, "QUEUED");

  return {
    ok: true as const,
    body: {
      fileId: file.id,
      jobId: job.id,
      status: job.status,
      stream: "taskflow:jobs",
      streamMessageId
    }
  };
};

app.get(["/health", "/api/health"], async (_request, response) => {
  const health: {
    status: "ok" | "degraded";
    database: "connected" | "disconnected";
    redis: "connected" | "disconnected";
  } = {
    status: "ok",
    database: "disconnected",
    redis: "disconnected"
  };

  try {
    await pool.query("SELECT 1");
    health.database = "connected";
  } catch (error) {
    console.error("Health check database error:", error);
    health.status = "degraded";
  }

  try {
    if (!redisClient.isReady) {
      throw new Error("Redis client is not ready.");
    }
    const ping = await redisClient.ping();
    if (ping !== "PONG") {
      throw new Error(`Unexpected Redis PING response: ${ping}`);
    }
    health.redis = "connected";
  } catch (error) {
    console.error("Health check redis error:", error);
    health.status = "degraded";
  }

  response.status(health.status === "ok" ? 200 : 503).json(health);
});

app.get("/api/files", async (_request, response) => {
  try {
    response.json(await listFiles());
  } catch (error) {
    console.error("Failed to list files:", error);
    sendError(response, 500, "INTERNAL_ERROR", "Unable to list files.");
  }
});

app.post("/api/files", async (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const contentType =
    typeof request.body?.contentType === "string" && request.body.contentType
      ? request.body.contentType
      : "text/csv";
  const size = Number(request.body?.size);

  if (!name) {
    sendError(response, 400, "INVALID_FILE", "File name is required.");
    return;
  }
  if (!/\.csv$/i.test(name)) {
    sendError(response, 400, "INVALID_FILE", "Only CSV files are supported.");
    return;
  }
  if (!Number.isInteger(size) || size <= 0 || size > 10 * 1024 * 1024) {
    sendError(response, 400, "FILE_TOO_LARGE", "CSV file must be between 1 byte and 10 MB.");
    return;
  }

  try {
    const id = randomUUID();
    const storedPath = `uploads/${id}/${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const file = await createFile({
      id,
      name,
      storedPath,
      mimeType: contentType,
      sizeBytes: size
    });
    const uploadUrl = await createUploadUrl(storedPath, contentType, size);
    response.status(201).json({ fileId: file.id, file, uploadUrl });
  } catch (error) {
    console.error("Failed to create file:", error);
    sendError(response, 500, "INTERNAL_ERROR", "Unable to create file.");
  }
});

app.post("/api/files/:fileId/queue", async (request, response) => {
  try {
    const result = await queueFileForProcessing(request.params.fileId);
    if (!result.ok) {
      sendError(response, result.status, result.code, result.message);
      return;
    }
    response.status(201).json(result.body);
  } catch (error) {
    console.error("Failed to queue file:", error);
    sendError(response, 500, "PROCESSING_FAILED", "Unable to queue file for processing.");
  }
});

app.get("/api/files/:fileId", async (request, response) => {
  try {
    const file = await getFileDetails(request.params.fileId);
    if (!file) {
      sendError(response, 404, "FILE_NOT_FOUND", "File not found.");
      return;
    }

    const job = await findLatestJobByFileId(file.id);
    response.json({
      ...file,
      job: job ? toJobSummary(job) : null
    });
  } catch (error) {
    console.error("Failed to get file details:", error);
    sendError(response, 500, "INTERNAL_ERROR", "Unable to load file details.");
  }
});

app.post("/api/jobs/:jobId/retry", async (request, response) => {
  try {
    const existingJob = await findJob(request.params.jobId);
    if (!existingJob) {
      sendError(response, 404, "JOB_NOT_FOUND", "Job not found.");
      return;
    }
    if (existingJob.status !== "FAILED") {
      sendError(response, 409, "JOB_NOT_RETRYABLE", "Only failed jobs can be retried.");
      return;
    }

    const file = await findStoredFile(existingJob.file_id);
    if (!file) {
      sendError(response, 404, "FILE_NOT_FOUND", "File not found for this job.");
      return;
    }
    if (!file.stored_path) {
      sendError(response, 409, "INVALID_FILE", "File has no stored object.");
      return;
    }

    const job = await resetFailedJobForRetry(existingJob.id);
    if (!job) {
      sendError(response, 409, "JOB_NOT_RETRYABLE", "Only failed jobs can be retried.");
      return;
    }

    const streamMessageId = await publishJob({
      jobId: job.id,
      fileId: job.file_id,
      type: "CSV_PROCESS"
    });
    await updateFileStatus(job.file_id, "QUEUED");

    response.status(200).json({
      jobId: job.id,
      fileId: job.file_id,
      status: job.status,
      stream: "taskflow:jobs",
      streamMessageId
    });
  } catch (error) {
    console.error("Failed to retry job:", error);
    sendError(response, 500, "PROCESSING_FAILED", "Unable to retry job.");
  }
});

app.get(["/files/:fileId/download", "/api/files/:fileId/download"], async (request, response) => {
  const fileId = Array.isArray(request.params.fileId)
    ? request.params.fileId[0]
    : request.params.fileId;

  try {
    const file = await findStoredFile(fileId);
    if (!file) {
      sendError(response, 404, "FILE_NOT_FOUND", "File not found.");
      return;
    }
    if (!file.stored_path) {
      sendError(response, 404, "INVALID_FILE", "File has no stored object.");
      return;
    }
    response.json({ downloadUrl: await createDownloadUrl(file.stored_path) });
  } catch (error) {
    console.error("Failed to create download URL:", error);
    sendError(response, 500, "INTERNAL_ERROR", "Unable to create download URL.");
  }
});

app.get("/api/files/:fileId/rows", async (request, response) => {
  const page = Math.max(1, Number.parseInt(request.query.page as string || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(request.query.pageSize as string || "100", 10) || 100)
  );

  try {
    const file = await findStoredFile(request.params.fileId);
    if (!file) {
      sendError(response, 404, "FILE_NOT_FOUND", "File not found.");
      return;
    }
    response.json(await listRows(file.id, page, pageSize));
  } catch (error) {
    console.error("Failed to list file rows:", error);
    sendError(response, 500, "INTERNAL_ERROR", "Unable to list file rows.");
  }
});

app.get("/api/dead-letter", async (request, response) => {
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(request.query.limit as string || "50", 10) || 50)
  );

  try {
    response.json({
      stream: deadLetterStream,
      entries: await listDeadLetterEntries(limit)
    });
  } catch (error) {
    console.error("Failed to list dead-letter entries:", error);
    sendError(response, 500, "INTERNAL_ERROR", "Unable to list dead-letter entries.");
  }
});

const start = async () => {
  await initializeDatabase();
  await initializeStorage();
  await initializeRedis();
  const server = app.listen(port, () => {
    console.log(`TaskFlow API listening on http://localhost:${port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`TaskFlow API received ${signal}; shutting down.`);
    server.close(async () => {
      await closeRedis();
      process.exit(0);
    });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
};

start().catch((error) => {
  console.error("Failed to initialize the API:", error);
  process.exitCode = 1;
});
