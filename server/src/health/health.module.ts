import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { DbModule } from '../db/db.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DbModule, RedisModule],
  providers: [HealthService],
  controllers: [HealthController],
})
export class HealthModule {}
