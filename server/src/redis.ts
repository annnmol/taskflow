import dotenv from "dotenv";
import { resolve } from "node:path";
import { createClient } from "redis";

dotenv.config({ path: resolve(process.cwd(), ".env") });

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
export const jobsStream = "taskflow:jobs";
export const deadLetterStream = "taskflow:dead-letter";

redisClient.on("error", (error) => {
  console.error("Redis client error:", error);
});

export const initializeRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  const response = await redisClient.ping();
  if (response !== "PONG") {
    throw new Error(`Unexpected Redis PING response: ${response}`);
  }

  console.log("Redis connected (PING: PONG).");
};

export const closeRedis = async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
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

export type DeadLetterEntry = {
  id: string;
  jobId: string;
  fileId: string;
  type: string;
  errorMessage: string;
  attempts: number;
  maxAttempts: number;
  failedAt: string;
  sourceStream: string;
  sourceMessageId: string | null;
};

export const listDeadLetterEntries = async (limit: number): Promise<DeadLetterEntry[]> => {
  if (!redisClient.isReady) {
    throw new Error("Redis is not ready.");
  }

  const entries = await redisClient.xRevRange(deadLetterStream, "+", "-", { COUNT: limit });
  return entries.map((entry) => ({
    id: entry.id,
    jobId: entry.message.jobId ?? "",
    fileId: entry.message.fileId ?? "",
    type: entry.message.type ?? "",
    errorMessage: entry.message.errorMessage ?? "",
    attempts: Number.parseInt(entry.message.attempts ?? "0", 10) || 0,
    maxAttempts: Number.parseInt(entry.message.maxAttempts ?? "0", 10) || 0,
    failedAt: entry.message.failedAt ?? "",
    sourceStream: entry.message.sourceStream ?? jobsStream,
    sourceMessageId: entry.message.sourceMessageId ?? null
  }));
};
