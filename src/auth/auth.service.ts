import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/users.schema';
import { CheckUserExistsResponse } from './auth.model';
import { BetterAuthTokenPayload } from './better-auth-token.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Takes an already-verified Better Auth token payload (see
   * BetterAuthTokenService) and finds the matching domain user profile, or
   * returns a transient shape so the frontend can call `createUser`.
   */
  async validateAndLinkUser(
    payload: BetterAuthTokenPayload,
  ): Promise<UserDocument | { authUserId: string } | null> {
    const { sub: authUserId } = payload;
    if (!authUserId) {
      throw new Error('No subject found in Better Auth token');
    }

    const user = await this.usersService.findByAuthUserId(authUserId);
    return user || { authUserId };
  }

  /**
   * Checks if a user exists in our database using their email.
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
   * Checks if a user exists in our database using their phone number.
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
}
