import { Module } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminsModule } from '../admins/admins.module'; // To access AdminUsersService
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminLocalStrategy } from './strategies/admin-local.strategy';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminAuthResolver } from './admin-auth.resolver';
import { AdminLocalAuthGuard } from './guards/admin-local-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [
    AdminsModule, // Provides AdminUsersService
    PassportModule.register({ defaultStrategy: 'admin-jwt', session: false }), // Default for admin routes
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('ADMIN_JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('ADMIN_JWT_EXPIRES_IN', '1h'), // e.g., 1h, 7d
        },
      }),
      inject: [ConfigService],
    }),
  ],

  providers: [
    AdminAuthService,
    AdminLocalStrategy,
    AdminJwtStrategy,
    AdminLocalAuthGuard,
    AdminAuthGuard,
    AdminAuthResolver,
  ],
  exports: [AdminAuthService, JwtModule],
})
export class AdminAuthModule {}
