import { forwardRef, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesRepository } from './files.repository';
import { FilesService } from './files.service';
import { DbModule } from '../db/db.module';
import { StorageModule } from '../storage/storage.module';
import { RedisModule } from '../redis/redis.module';
import { JobsModule } from '../jobs/jobs.module';
import { RowsRepository } from './rows.repository';

@Module({
  imports: [DbModule, RedisModule, StorageModule, forwardRef(() => JobsModule)],
  controllers: [FilesController],
  providers: [FilesService, FilesRepository, RowsRepository],
  exports: [FilesService, FilesRepository],
})
export class FilesModule {}
