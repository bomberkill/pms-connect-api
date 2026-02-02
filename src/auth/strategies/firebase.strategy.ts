import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Strategy, ExtractJwt } from 'passport-firebase-jwt';
import * as admin from 'firebase-admin';
import { AuthService } from '../auth.service';
import { FIREBASE_ADMIN_APP } from '../../firebase/firebase.constants';
import { Inject } from '@nestjs/common';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly firebaseApp: admin.app.App,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(token: string) {
    // The token is already decoded by passport-firebase-jwt using firebase-admin
    if (!token) {
      throw new UnauthorizedException('No token provided or token invalid');
    }
    // The `validateUser` method in AuthService will find or create
    // a local user profile based on the Firebase token payload.
    const user = await this.authService.validateAndLinkUser(token);
    if (!user) {
      throw new UnauthorizedException(
        'User not found or could not be created/linked.',
      );
    }
    return user; // This will be attached to req.user
  }
}
