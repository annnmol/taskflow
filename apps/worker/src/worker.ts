import { parse } from "csv-parse/sync";
import {
  claimStalePendingMessages,
  getPendingCount,
  initializeRedis,
  jobsStream,
  publishJob,
  publishToDeadLetter,
  readNewMessages,
  readOwnPendingMessages,
  redisClient,
  workersGroup,
  type StreamJobMessage,
  type StreamMessage
} from "./redis.js";
import { readObject } from "./storage.js";
import { pool } from "./db.js";
import { findFile, updateFileStatus } from "./repositories/files.js";
import {
  findJob,
  markJobCompleted,
  markJobProcessing,
  markJobQueued,
  recordJobFailure
} from "./repositories/jobs.js";
import { insertRows } from "./repositories/rows.js";
import { getConsumerName, workerConfig } from "./lib/config.js";

const consumerName = getConsumerName();
const {
  maxConcurrency,
  pendingClaimIdleMs,
  readBlockMs,
  failProcessing,
  retryBaseDelayMs,
  retryMaxDelayMs
} = workerConfig;

type JobMessage = StreamJobMessage;

let activeJobs = 0;
let isShuttingDown = false;

const sleep = async (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const computeRetryDelay = (attempts: number): number =>
  Math.min(retryMaxDelayMs, retryBaseDelayMs * 2 ** Math.max(0, attempts - 1));

const processMessage = async (messageId: string, fields: JobMessage, source: StreamMessage["source"]) => {
  if (!fields.jobId || !fields.fileId || fields.type !== "CSV_PROCESS") {
    console.error("Skipping malformed job message:", fields);
    await redisClient.xAck(jobsStream, workersGroup, messageId);
    return;
  }

  const job = await findJob(fields.jobId);
  if (!job || job.status === "COMPLETED" || job.status === "FAILED") {
    if (source !== "new") {
      console.log(
        `[${consumerName}] Acknowledging ${source} message ${messageId} for terminal job ${fields.jobId}.`
      );
    }
    await redisClient.xAck(jobsStream, workersGroup, messageId);
    return;
  }

  if (source !== "new") {
    console.log(
      `[${consumerName}] Reclaimed ${source} message ${messageId} for job ${job.id} (status: ${job.status}).`
    );
  }

  console.log(`[${consumerName}] Processing job ${job.id} (${activeJobs}/${maxConcurrency} active).`);

  try {
    const file = await findFile(job.file_id);
    if (!file?.stored_path) {
      throw new Error(`File has no stored object: ${job.file_id}`);
    }

    await markJobProcessing(job.id);
    await updateFileStatus(job.file_id, "PROCESSING");

    if (failProcessing) {
      throw new Error("Simulated processing failure (workerConfig.failProcessing=true).");
    }

    const content = await readObject(file.stored_path);
    const rows = parse<Record<string, string>>(content, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    await insertRows(job.file_id, rows);

    await markJobCompleted(job.id);
    await updateFileStatus(job.file_id, "COMPLETED");
    console.log(`Completed job ${job.id} (${rows.length} rows).`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown processing error.";
    console.error(`Failed job ${job.id}:`, error);

    const failureState = await recordJobFailure(job.id, errorMessage);
    if (failureState.status === "FAILED") {
      await updateFileStatus(job.file_id, "FAILED");
      const deadLetterMessageId = await publishToDeadLetter({
        jobId: job.id,
        fileId: job.file_id,
        type: "CSV_PROCESS",
        errorMessage,
        attempts: failureState.attempts,
        maxAttempts: failureState.max_attempts,
        sourceMessageId: messageId
      });
      console.error(
        `Job ${job.id} failed permanently after ${failureState.attempts}/${failureState.max_attempts} attempts; moved to dead-letter stream as ${deadLetterMessageId}.`
      );
    } else {
      const retryDelayMs = computeRetryDelay(failureState.attempts);
      console.log(
        `Retrying job ${job.id} in ${retryDelayMs}ms (attempt ${failureState.attempts}/${failureState.max_attempts}).`
      );
      await sleep(retryDelayMs);
      await markJobQueued(job.id);
      await updateFileStatus(job.file_id, "QUEUED");
      await publishJob({
        jobId: job.id,
        fileId: job.file_id,
        type: "CSV_PROCESS"
      });
    }
  } finally {
    await redisClient.xAck(jobsStream, workersGroup, messageId);
  }
};

const dispatchMessage = (message: StreamMessage): void => {
  activeJobs++;
  void processMessage(message.id, message.message, message.source).finally(() => {
    activeJobs--;
  });
};

const pollMessages = async (count: number): Promise<StreamMessage[]> => {
  const messages: StreamMessage[] = [];

  const ownPending = await readOwnPendingMessages(consumerName, count);
  messages.push(...ownPending);
  if (messages.length >= count) {
    return messages.slice(0, count);
  }

  const claimed = await claimStalePendingMessages(
    consumerName,
    count - messages.length,
    pendingClaimIdleMs
  );
  messages.push(...claimed);
  if (messages.length >= count) {
    return messages.slice(0, count);
  }

  const fresh = await readNewMessages(
    consumerName,
    count - messages.length,
    messages.length === 0 ? readBlockMs : 0
  );
  messages.push(...fresh);
  return messages;
};

const run = async () => {
  await initializeRedis();
  const pendingCount = await getPendingCount();
  console.log(
    `TaskFlow worker ${consumerName} listening on ${jobsStream} (max concurrency: ${maxConcurrency}, pending reclaim idle: ${pendingClaimIdleMs}ms).`
  );
  if (failProcessing) {
    console.warn(`[${consumerName}] workerConfig.failProcessing=true — every job will fail for retry/DLQ testing.`);
  }
  if (pendingCount > 0) {
    console.log(`[${consumerName}] Found ${pendingCount} pending stream message(s) to recover.`);
  }

  while (redisClient.isReady && !isShuttingDown) {
    if (activeJobs >= maxConcurrency) {
      await sleep(50);
      continue;
    }

    const messages = await pollMessages(maxConcurrency - activeJobs);
    for (const message of messages) {
      dispatchMessage(message);
    }
  }
};

const shutdown = async (signal: string) => {
  console.log(`TaskFlow worker received ${signal}; shutting down.`);
  isShuttingDown = true;

  while (activeJobs > 0) {
    console.log(`[${consumerName}] Waiting for ${activeJobs} in-flight job(s) to finish.`);
    await sleep(100);
  }

  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

run().catch(async (error) => {
  console.error("Failed to initialize the worker:", error);
  if (redisClient.isOpen) {
    await redisClient.quit().catch(() => undefined);
  }
  await pool.end();
  process.exitCode = 1;
});
