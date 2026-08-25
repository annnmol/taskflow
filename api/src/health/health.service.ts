import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DbService } from '../db/db.service';

export type HealthResponse = {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
};

@Injectable()
export class HealthService {
  constructor(
    private readonly dbService: DbService,
    private readonly redisService: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const health: HealthResponse = {
      status: 'ok',
      database: 'disconnected',
      redis: 'disconnected',
    };

    try {
      await this.dbService.query('SELECT 1');

      health.database = 'connected';
    } catch (error) {
      console.error('Health check database error:', error);

      health.status = 'degraded';
    }

    try {
      const ping = await this.redisService.ping();

      if (ping !== 'PONG') {
        throw new Error(`Unexpected Redis PING response: ${ping}`);
      }

      health.redis = 'connected';
    } catch (error) {
      console.error('Health check redis error:', error);

      health.status = 'degraded';
    }

    return health;
  }
}
