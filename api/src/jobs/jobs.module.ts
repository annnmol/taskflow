import { forwardRef, Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';
import { DbModule } from '../db/db.module';
import { FilesModule } from '../files/files.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DbModule, forwardRef(() => FilesModule), RedisModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository],
  exports: [JobsService, JobsRepository],
})
export class JobsModule {}
