import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { jwtVerify } from 'jose';
import { AuthService } from '../auth.service';
import { AdminAuthService } from '../../admin-auth/admin-auth.service';
import { BetterAuthTokenService } from '../better-auth-token.service';

@Injectable()
export class CombinedStrategy extends PassportStrategy(Strategy, 'combined') {
  private readonly logger = new Logger(CombinedStrategy.name);
  private readonly adminSecret: Uint8Array;

  constructor(
    private readonly authService: AuthService,
    private readonly adminAuthService: AdminAuthService,
    private readonly betterAuthTokenService: BetterAuthTokenService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.adminSecret = new TextEncoder().encode(
      this.configService.get<string>(
        'ADMIN_JWT_SECRET',
        'DEFAULT_ADMIN_SECRET_KEY_32_CHARS',
      ),
    );
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header.',
      );
    }
    const token = authHeader.substring(7);

    // --- Logique d'aiguillage ---
    // On tente d'abord un token utilisateur (Better Auth, verifie via JWKS).
    try {
      const payload = await this.betterAuthTokenService.verify(token);
      this.logger.debug('Detected Better Auth token, delegating to AuthService.');
      return this.authService.validateAndLinkUser(payload);
    } catch {
      // Pas un token Better Auth valide : on tente le token admin interne.
    }

    this.logger.debug('Assuming admin token, verifying signature.');
    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(token, this.adminSecret, {
        algorithms: ['HS256'],
      });
      payload = result.payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      !Array.isArray(payload.roles)
    ) {
      throw new UnauthorizedException(
        'Token admin invalide : le payload est malformé.',
      );
    }

    return this.adminAuthService.validateJwtPayload(
      payload as { sub: string; email: string; roles: string[] },
    );
  }
}
