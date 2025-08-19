import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from '../admin-auth.service';
import { AdminUserDocument } from '../../admins/admin-user.schema';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private configService: ConfigService,
    private adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('ADMIN_JWT_SECRET', 'DEFAULT_ADMIN_SECRET_KEY_32_CHARS'),
    });
  }

  async validate(payload: { sub: string; email: string; roles: string[] }): Promise<AdminUserDocument> {
    const admin = await this.adminAuthService.validateJwtPayload(payload);
    if (!admin || !admin.isActive || admin.isLockedOut) {
      throw new UnauthorizedException('Admin not found, inactive, or locked out.');
    }
    return admin; // This becomes req.user for JWT protected routes
  }
}