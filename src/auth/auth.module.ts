import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { FirebaseModule } from '../firebase/firebase.module'; // Import FirebaseModule
import { AuthResolver } from './auth.resolver';


@Module({
    imports: [
        FirebaseModule, // Make sure Firebase Admin App is available
        PassportModule.register({ defaultStrategy: 'firebase' }),
        UsersModule, // To interact with UsersService
      ],
      providers: [AuthService, FirebaseStrategy, AuthResolver],
      exports: [AuthService, PassportModule],
})
export class AuthModule {}
