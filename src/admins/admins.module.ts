import { Module } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AdminsResolver } from './admins.resolver';

@Module({
  providers: [AdminsService, AdminsResolver],
  exports: [AdminsService], // Export if other modules (like an AdminAuthModule) need it
})
export class AdminsModule {}
