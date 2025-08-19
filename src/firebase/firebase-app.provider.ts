import * as admin from 'firebase-admin';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FIREBASE_ADMIN_APP } from './firebase.constants';
import * as fs from 'fs';

export const FirebaseAppProvider: Provider<admin.app.App> = {
  provide: FIREBASE_ADMIN_APP,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const serviceAccountPath = configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_KEY_PATH',
    );
    const serviceAccountConfig = configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_CONFIG',
    );

    let credential;
    if (serviceAccountConfig) {
      credential = admin.credential.cert(JSON.parse(serviceAccountConfig));
    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      credential = admin.credential.cert(serviceAccountPath);
    } else {
      // Fallback for environments like Google Cloud Run/Functions if GOOGLE_APPLICATION_CREDENTIALS is set
      credential = admin.credential.applicationDefault();
    }

    if (admin.apps.length === 0) {
      return admin.initializeApp({ credential });
    }
    return admin.app(); // Return existing app if already initialized
  },
};