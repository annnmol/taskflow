import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "redis";
import { workerConfig } from "./lib/config.js";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

const redisUrl = process.env.REDIS_URL || (() => {
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const host = process.env.REDIS_HOST || "localhost";
  const port = Number(process.env.REDIS_PORT) || 6379;
  const credentials =
    username || password
      ? `${encodeURIComponent(username || "")}:${encodeURIComponent(password || "")}@`
      : "";

  return `redis://${credentials}${host}:${port}`;
})();

export const redisClient = createClient({ url: redisUrl });
export const jobsStream = workerConfig.jobsStreamKey;
export const workersGroup = workerConfig.workersGroupName;
export const deadLetterStream = workerConfig.deadLetterStreamKey;

redisClient.on("error", (error) => {
  console.error("Redis client error:", error);
});

export const initializeRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  await redisClient.ping();
  try {
    await redisClient.xGroupCreate(jobsStream, workersGroup, "0", { MKSTREAM: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
      throw error;
    }
  }
};

export const publishJob = async (input: {
  jobId: string;
  fileId: string;
  type: "CSV_PROCESS";
}): Promise<string> => {
  if (!redisClient.isReady) {
    throw new Error("Redis is not ready.");
  }

  return redisClient.xAdd(jobsStream, "*", {
    jobId: input.jobId,
    fileId: input.fileId,
    type: input.type
  });
};

export const publishToDeadLetter = async (input: {
  jobId: string;
  fileId: string;
  type: "CSV_PROCESS";
  errorMessage: string;
  attempts: number;
  maxAttempts: number;
  sourceMessageId?: string;
}): Promise<string> => {
  if (!redisClient.isReady) {
    throw new Error("Redis is not ready.");
  }

  return redisClient.xAdd(deadLetterStream, "*", {
    jobId: input.jobId,
    fileId: input.fileId,
    type: input.type,
    errorMessage: input.errorMessage,
    attempts: String(input.attempts),
    maxAttempts: String(input.maxAttempts),
    failedAt: new Date().toISOString(),
    sourceStream: jobsStream,
    ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {})
  });
};

export type StreamJobMessage = {
  jobId?: string;
  fileId?: string;
  type?: string;
};

export type StreamMessage = {
  id: string;
  message: StreamJobMessage;
  source: "own-pending" | "claimed" | "new";
};

const toStreamMessages = (
  messages: Array<{ id: string; message: Record<string, string> }>,
  source: StreamMessage["source"]
): StreamMessage[] =>
  messages.map((message) => ({
    id: message.id,
    message: message.message as StreamJobMessage,
    source
  }));

export const getPendingCount = async (): Promise<number> => {
  const summary = await redisClient.xPending(jobsStream, workersGroup);
  return summary.pending;
};

export const readOwnPendingMessages = async (
  consumerName: string,
  count: number
): Promise<StreamMessage[]> => {
  if (count <= 0) {
    return [];
  }

  const result = await redisClient.xReadGroup(
    workersGroup,
    consumerName,
    [{ key: jobsStream, id: "0" }],
    { COUNT: count }
  );

  return toStreamMessages(result?.[0]?.messages ?? [], "own-pending");
};

export const claimStalePendingMessages = async (
  consumerName: string,
  count: number,
  minIdleMs: number
): Promise<StreamMessage[]> => {
  if (count <= 0) {
    return [];
  }

  const result = await redisClient.xAutoClaim(
    jobsStream,
    workersGroup,
    consumerName,
    minIdleMs,
    "0-0",
    { COUNT: count }
  );

  const claimedMessages = result.messages.filter(
    (message): message is { id: string; message: Record<string, string> } => message !== null
  );

  return toStreamMessages(claimedMessages, "claimed");
};

export const readNewMessages = async (
  consumerName: string,
  count: number,
  blockMs: number
): Promise<StreamMessage[]> => {
  if (count <= 0) {
    return [];
  }

  const result = await redisClient.xReadGroup(
    workersGroup,
    consumerName,
    [{ key: jobsStream, id: ">" }],
    { COUNT: count, BLOCK: blockMs }
  );

  return toStreamMessages(result?.[0]?.messages ?? [], "new");
};
