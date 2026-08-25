import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService],
  exports: [RedisService], // Export the RedisService so it can be used in other modules
})
export class RedisModule {}
