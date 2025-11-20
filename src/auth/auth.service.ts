import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/users.schema';
import * as admin from 'firebase-admin';
import { SpecialityGQL, UserTypeGQL } from '../users/models/users.model'; // For default userType
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
  
      let user = await this.usersService.findByFirebaseUid(uid);
  
      // if (!user) {
      //   // If user doesn't exist, create a basic profile.
      //   // You might want to prompt the user for more details (like userType) on the client-side
      //   // after their first login, or have a default.
      //   // For now, let's assume a default or that this info might come from custom claims.
      //   try {
      //     user = await this.usersService.create({
      //       // firebaseUid: uid,
      //       email: email,
      //       // Defaulting userType, this should ideally be determined more robustly
      //       userType: UserTypeGQL.INDIVIDUAL, // Or based on custom claims
      //       // profilePicUrl: picture,
      //       // // For INDIVIDUAL, firstName/lastName might be derived from 'name' or be empty initially
      //       firstName: 'firstname', // Basic default
      //       lastName: 'lastname', // Basic default
      //       speciality: SpecialityGQL.NURSES
      //     }, uid);
      //     // return newUser;
      //   } catch (error) {
      //     // Handle potential creation errors (e.g., duplicate email if not handled by findByFirebaseUid first)
      //     console.error('Error creating user during Firebase link:', error);
      //     return null;
      //   }
      // }
      // return user;
      return user || { firebaseUid: uid };
    }

    /**
   * Checks if a user exists in Firebase Authentication using their email.
   * This uses the Admin SDK and is not subject to email enumeration protection.
   * @param email The email to check.
   * @returns `true` if the user exists, `false` otherwise.
   */
    async checkUserExistsByEmail(email: string): Promise<CheckUserExistsResponse> {
      try {
        const user = await admin.auth().getUserByEmail(email);

        // Liste des providers associés
        const providers = user.providerData.map((p) => p.providerId);

        // Vérifie si 'password' fait partie des providers
        const hasPassword = providers.includes("password");

        return {
          exists: true,
          hasPassword,
          providers,
        };
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          return {
            exists: false,
            hasPassword: false,
            providers: [],
          };
        }
        throw error; // Autres erreurs (ex: réseau, permission, etc.)
      }
    }

    /**
     * Checks if a user exists in Firebase Authentication using their phone number.
     * @param phoneNumber The phone number to check (must be in E.164 format).
     * @returns An object indicating if the user exists and their sign-in providers.
     */
    async checkUserExistsByPhoneNumber(phoneNumber: string): Promise<CheckUserExistsResponse> {
      try {
        const user = await admin.auth().getUserByPhoneNumber(phoneNumber);

        // Liste des providers associés
        const providers = user.providerData.map((p) => p.providerId);

        // Vérifie si 'password' fait partie des providers
        const hasPassword = providers.includes("password");

        return {
          exists: true,
          hasPassword,
          providers,
        };
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          return { exists: false, hasPassword: false, providers: [] };
        }
        // Pour les autres erreurs (numéro invalide, etc.), il est préférable de les lancer
        throw error;
      }
    }
  }
