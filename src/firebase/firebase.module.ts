import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAppProvider } from './firebase-app.provider';
import { FIREBASE_ADMIN_APP, FIREBASE_MESSAGING } from './firebase.constants';
import { getMessaging } from 'firebase-admin/messaging';
import * as admin from 'firebase-admin';

@Global() // Make Firebase Admin App available globally
@Module({
  imports: [ConfigModule], // Ensure ConfigService is available
  providers: [
    FirebaseAppProvider,
    {
      provide: FIREBASE_MESSAGING,
      useFactory: (app: admin.app.App) => getMessaging(app),
      inject: [FIREBASE_ADMIN_APP],
    },
  ],
  exports: [FirebaseAppProvider, FIREBASE_MESSAGING],
})
export class FirebaseModule {}