import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { FirebaseModule } from '../firebase/firebase.module'; // Import FirebaseModule
import { AuthResolver } from './auth.resolver';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { CombinedStrategy } from './strategies/combined.strategy';
import { AdminAuthModule } from 'src/admin-auth/admin-auth.module';


@Module({
    imports: [
        FirebaseModule, // Make sure Firebase Admin App is available
        PassportModule.register({ defaultStrategy: 'firebase' }),
        forwardRef(() => UsersModule), // Utiliser forwardRef pour résoudre la dépendance circulaire
        AdminAuthModule // To interact with UsersService
      ],
      providers: [AuthService, FirebaseStrategy, AuthResolver, CombinedAuthGuard, CombinedStrategy],
      exports: [AuthService, PassportModule, CombinedAuthGuard],
})
export class AuthModule {}
