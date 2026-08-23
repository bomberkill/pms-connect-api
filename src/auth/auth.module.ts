import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { BetterAuthStrategy } from './strategies/better-auth.strategy';
import { BetterAuthTokenService } from './better-auth-token.service';
import { AuthResolver } from './auth.resolver';
import { BetterAuthGuard } from './guards/better-auth.guard';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { CombinedStrategy } from './strategies/combined.strategy';
import { AdminAuthModule } from 'src/admin-auth/admin-auth.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'better-auth' }),
    forwardRef(() => UsersModule), // Utiliser forwardRef pour résoudre la dépendance circulaire
    AdminAuthModule, // To interact with UsersService
  ],
  providers: [
    AuthService,
    BetterAuthTokenService,
    BetterAuthStrategy,
    AuthResolver,
    BetterAuthGuard,
    CombinedAuthGuard,
    CombinedStrategy,
  ],
  exports: [
    AuthService,
    BetterAuthTokenService,
    PassportModule,
    BetterAuthGuard,
    CombinedAuthGuard,
  ],
})
export class AuthModule {}
