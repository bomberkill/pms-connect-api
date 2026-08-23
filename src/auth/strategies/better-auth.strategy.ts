import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { BetterAuthTokenService } from '../better-auth-token.service';

@Injectable()
export class BetterAuthStrategy extends PassportStrategy(
  Strategy,
  'better-auth',
) {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: BetterAuthTokenService,
  ) {
    super();
  }

  async validate(req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided or token invalid');
    }
    const token = authHeader.substring(7);

    const payload = await this.tokenService.verify(token);
    const user = await this.authService.validateAndLinkUser(payload);
    if (!user) {
      throw new UnauthorizedException(
        'User not found or could not be created/linked.',
      );
    }
    return user; // This will be attached to req.user
  }
}
