import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { RequestLoggingMiddleware } from './config/log.middleware';
import { StorageModule } from './storage/storage.module';
import { RedisModule } from './redis/redis.module';
import { DbModule } from './db/db.module';
import { FilesModule } from './files/files.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    StorageModule,
    RedisModule,
    DbModule,
    FilesModule,
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
