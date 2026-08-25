import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export type JobType = 'CSV_PROCESS';

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

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;
  private readonly jobsStream = 'taskflow:jobs';
  private readonly deadLetterStream = 'taskflow:dead-letter';

  constructor(private readonly configService: ConfigService) {
    const username = this.configService.getOrThrow<string>('REDIS_USERNAME');
    const password = this.configService.getOrThrow<string>('REDIS_PASSWORD');
    const host = this.configService.getOrThrow<string>('REDIS_HOST');
    const port = this.configService.getOrThrow<number>('REDIS_PORT');

    const credentials =
      username || password
        ? `${encodeURIComponent(username ?? '')}:${encodeURIComponent(
            password ?? '',
          )}@`
        : '';

    const redisUrl = `redis://${credentials}${host}:${port}`;

    this.client = createClient({
      url: redisUrl,
    });

    this.client.on('error', (error) => {
      this.logger.error(
        `Redis client error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }

    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error(`Unexpected Redis PING response: ${response}`);
    }

    this.logger.log('Redis connected (PING: PONG).');
  }

  private async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async publishJob(input: {
    jobId: string;
    fileId: string;
    type: JobType;
  }): Promise<string> {
    if (!this.client.isReady) {
      throw new Error('Redis is not ready.');
    }

    return this.client.xAdd(this.jobsStream, '*', {
      jobId: input.jobId,
      fileId: input.fileId,
      type: input.type,
    });
  }

  async listDeadLetterEntries(limit: number): Promise<DeadLetterEntry[]> {
    if (!this.client.isReady) {
      throw new Error('Redis is not ready.');
    }

    const entries = await this.client.xRevRange(
      this.deadLetterStream,
      '+',
      '-',
      {
        COUNT: limit,
      },
    );

    return entries.map((entry) => ({
      id: entry.id,
      jobId: entry.message.jobId ?? '',
      fileId: entry.message.fileId ?? '',
      type: entry.message.type ?? '',
      errorMessage: entry.message.errorMessage ?? '',
      attempts: Number.parseInt(entry.message.attempts ?? '0', 10) || 0,
      maxAttempts: Number.parseInt(entry.message.maxAttempts ?? '0', 10) || 0,
      failedAt: entry.message.failedAt ?? '',
      sourceStream: entry.message.sourceStream ?? this.jobsStream,
      sourceMessageId: entry.message.sourceMessageId ?? null,
    }));
  }

  async ping(): Promise<string> {
    if (!this.client.isReady) {
      throw new Error('Redis client is not ready.');
    }

    return this.client.ping();
  }
}
