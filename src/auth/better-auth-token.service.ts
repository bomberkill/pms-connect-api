import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface BetterAuthTokenPayload {
  sub: string;
  email?: string;
}

/**
 * Verifies JWTs issued by Better Auth (running on the Next.js frontend) using
 * its JWKS endpoint, so the NestJS backend never needs the signing key itself.
 */
@Injectable()
export class BetterAuthTokenService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    this.issuer = this.configService.getOrThrow<string>('BETTER_AUTH_URL');
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/api/auth/jwks`));
  }

  async verify(token: string): Promise<BetterAuthTokenPayload> {
    let sub: unknown;
    let email: unknown;
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      sub = payload.sub;
      email = payload.email;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    if (typeof sub !== 'string') {
      throw new UnauthorizedException('Token missing subject claim.');
    }
    return { sub, email: typeof email === 'string' ? email : undefined };
  }
}
