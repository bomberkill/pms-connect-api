import { Module, Global } from '@nestjs/common';
import { FirebaseAppProvider } from './firebase-app.provider';
import { ConfigModule } from '@nestjs/config';

@Global() // Make Firebase Admin App available globally
@Module({
  imports: [ConfigModule], // Ensure ConfigService is available
  providers: [FirebaseAppProvider],
  exports: [FirebaseAppProvider],
})
export class FirebaseModule {}