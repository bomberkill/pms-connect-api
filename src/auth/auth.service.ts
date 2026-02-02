import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/users.schema';
import * as admin from 'firebase-admin';
import { CheckUserExistsResponse } from './auth.model';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async validateAndLinkUser(
    firebaseToken: string,
  ): Promise<UserDocument | { firebaseUid: string } | null> {
    // const { uid, email } = firebaseToken;
    if (!firebaseToken) {
      throw new Error('No Firebase token provided');
    }
    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (err) {
      console.error('Firebase token invalid:', err);
      throw new Error('Invalid Firebase token');
    }
    if (!decodedToken) {
      throw new Error('Invalid Firebase token');
    }
    const { uid, email } = decodedToken;

    if (!uid) {
      console.log('Firebase token:', firebaseToken);
      throw new Error('No Firebase UID found in token');
    }

    if (!email) {
      throw new Error('No Firebase email found in token');
    }

    const user = await this.usersService.findByFirebaseUid(uid);
    return user || { firebaseUid: uid };
  }

  /**
   * Checks if a user exists in Firebase Authentication using their email.
   * This uses the Admin SDK and is not subject to email enumeration protection.
   * @param email The email to check.
   * @returns `true` if the user exists, `false` otherwise.
   */
  async checkUserExistsByEmail(
    email: string,
  ): Promise<CheckUserExistsResponse> {
    // La source de vérité est notre base de données, pas Firebase.
    const user = await this.usersService.existsByEmail(email);
    if (!user) {
      return { exists: false, hasPassword: false, providers: [] };
    }

    const hasPassword = user.providers.includes('password');

    return { exists: true, hasPassword, providers: user.providers };
  }

  /**
   * Checks if a user exists in Firebase Authentication using their phone number.
   * @param phoneNumber The phone number to check (must be in E.164 format).
   * @returns An object indicating if the user exists and their sign-in providers.
   */
  async checkUserExistsByPhoneNumber(
    phoneNumber: string,
  ): Promise<CheckUserExistsResponse> {
    // La source de vérité est notre base de données, pas Firebase.
    // Note: Assurez-vous que la méthode findByPhoneNumber existe dans UsersService
    // et qu'elle gère correctement la normalisation des numéros si nécessaire.
    const user = await this.usersService.findByPhoneNumber(phoneNumber);
    if (!user) {
      return { exists: false, hasPassword: false, providers: [] };
    }

    const hasPassword = user.providers.includes('password');

    return { exists: true, hasPassword, providers: user.providers };
  }

  /**
   * Checks if a user exists in Firebase Authentication using their email.
   * This uses the Admin SDK and is not subject to email enumeration protection.
   * @param email The email to check.
   * @returns `true` if the user exists, `false` otherwise.
   */
}
