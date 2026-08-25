import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

@Module({
  providers: [StorageService],
  exports: [StorageService], // Export the StorageService so it can be used in other modules
})
export class StorageModule {}
