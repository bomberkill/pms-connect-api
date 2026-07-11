import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageService } from './storage.service';
import { StorageResolver } from './storage.resolver';

@Module({
  imports: [AuthModule],
  providers: [StorageService, StorageResolver],
  exports: [StorageService],
})
export class StorageModule {}
