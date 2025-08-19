import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from '../admin-auth.service';

@Injectable()
export class AdminLocalStrategy extends PassportStrategy(Strategy, 'admin-local') {
  constructor(private adminAuthService: AdminAuthService) {
    super({ usernameField: 'email' }); // Tell LocalStrategy to use 'email' field for username
  }

  async validate(email: string, pass: string): Promise<any> {
    console.log(`AdminLocalStrategy: Validating admin with email: ${email}`); // <--- ADD THIS LOG
    const admin = await this.adminAuthService.validateAdmin(email, pass);
    if (!admin) {
        console.log(`AdminLocalStrategy: Validation failed for email: ${email}`); // <--- ADD THIS LOG
      throw new UnauthorizedException('Invalid admin credentials or account inactive/locked.');
    }
    console.log(`AdminLocalStrategy: Validation successful for email: ${email}`, admin); // <--- ADD THIS LOG
    return admin; // This becomes req.user for the login route
  }
}