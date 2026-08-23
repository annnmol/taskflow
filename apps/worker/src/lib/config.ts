/**
 * Worker tuning and dev flags — not loaded from .env.
 * Edit here for concurrency, retry timing, crash-recovery demos, etc.
 */
export const workerConfig = {
  /** Set a stable id (e.g. "worker-1") for own-pending reclaim after restart. */
  workerId: undefined as string | undefined,
  maxConcurrency: 2,
  pendingClaimIdleMs: 30_000,
  readBlockMs: 5_000,
  /** Dev-only: force every job to fail for retry / dead-letter demos. */
  failProcessing: false,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 30_000,
  jobsStreamKey: "taskflow:jobs",
  workersGroupName: "taskflow-workers",
  deadLetterStreamKey: "taskflow:dead-letter"
} as const;

export const getConsumerName = (): string =>
  workerConfig.workerId ?? `worker-${process.pid}`;
