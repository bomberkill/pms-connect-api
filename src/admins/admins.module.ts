import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminUser, AdminUserSchema } from './admin-user.schema';
import { AdminsService } from './admins.service';
import { AdminsResolver } from './admins.resolver';

@Module({
    imports: [
      MongooseModule.forFeature([{ name: AdminUser.name, schema: AdminUserSchema }]),
    ],
    providers: [AdminsService, AdminsResolver],
    exports: [AdminsService], // Export if other modules (like an AdminAuthModule) need it
  })
  
export class AdminsModule {}
