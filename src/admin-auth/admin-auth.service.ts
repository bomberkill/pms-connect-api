import {
  Injectable,
  Logger, // Logger is still used in the code, so it should remain.
} from '@nestjs/common';
import { AdminsService } from '../admins/admins.service'; // Corrected path
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminUserDocument } from '../admins/admin-user.schema'; // Corrected path
import { EmailService } from '../email/email.service'; // Import EmailService

@Injectable()
export class AdminAuthService {
  constructor(
    private adminsService: AdminsService, // Service to interact with AdminUser model
    private jwtService: JwtService,
    private configService: ConfigService, // Inject ConfigService for JWT secret
    private emailService: EmailService, // Inject EmailService
  ) {}

  async validateAdmin(email: string, pass: string): Promise<any> {
    const admin = await this.adminsService.findByEmail(email);
    //   if (admin && (await admin.comparePassword(pass)) && admin.isActive && !admin.isLockedOut) {
    //     // Exclude passwordHash from the object returned
    //     const { passwordHash, ...result } = admin.toObject();
    //     return result;
    //   }
    //   // Optionally, increment failedLoginAttempts and handle lockout logic here or in AdminsService
    //   return null;
    if (admin) {
      const isPasswordMatch = await admin.comparePassword(pass);

      if (isPasswordMatch && admin.isActive && !admin.isLockedOut) {
        // const { passwordHash, ...result } = admin.toObject();
        return admin;
      }
    }
    return null;
  }

  async login(admin: AdminUserDocument) {
    const payload = {
      email: admin.email,
      sub: admin._id.toString(),
      roles: admin.roles,
    };
    // Update lastLoginAt
    admin.lastLoginAt = new Date();
    await admin.save();
    //   admin.save();
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  // Method to be used by AdminJwtStrategy to validate JWT payload
  async validateJwtPayload(payload: {
    sub: string;
    email: string;
    roles: string[];
  }): Promise<AdminUserDocument | null> {
    return this.adminsService.findById(payload.sub);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const admin = await this.adminsService.findByEmail(email);
    if (!admin) {
      // To prevent email enumeration, you might want to send a generic success message
      // or log this attempt without throwing an error visible to the user.
      // For now, let's throw NotFoundException for clarity in development.
      Logger.warn(
        `Password reset requested for non - existent admin email: ${email} `,
        AdminAuthService.name,
      );
      // throw new NotFoundException('If an account with this email exists, a password reset link has been sent.');
      return; // Silently fail to prevent email enumeration
    }

    const resetToken = await this.adminsService.createPasswordResetToken(admin);
    await this.emailService.sendPasswordResetEmail(
      admin.email,
      resetToken,
      admin.name,
    );
    Logger.log(
      `Password reset email sent to ${admin.email} `,
      AdminAuthService.name,
    );
  }

  async performPasswordResetAndNotify(
    token: string,
    newPassword: string,
  ): Promise<AdminUserDocument> {
    // Step 1: Reset the password using AdminsService
    const admin = await this.adminsService.resetPassword(token, newPassword);

    // Step 2: Send confirmation email using EmailService
    await this.emailService.sendPasswordResetConfirmationEmail(
      admin.email,
      admin.name,
    );

    Logger.log(
      `Password successfully reset and confirmation sent to ${admin.email} `,
      AdminAuthService.name,
    );
    return admin;
  }

  async verifyAdminToken(token: string): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        roles: string[];
      }>(token, {
        secret: this.configService.get<string>(
          'ADMIN_JWT_SECRET',
          'DEFAULT_ADMIN_SECRET_KEY_32_CHARS',
        ),
      });

      // After verifying the token structure and signature,
      // ensure the admin user still exists and is active.
      const admin = await this.adminsService.findById(payload.sub);
      if (admin && admin.isActive && !admin.isLockedOut) {
        Logger.log(
          `Admin token verified successfully for admin: ${payload.email} `,
          AdminAuthService.name,
        );
        return true;
      }
      Logger.warn(
        `Admin token for ${payload.email} is valid, but admin is inactive or locked out.`,
        AdminAuthService.name,
      );
      return false;
    } catch (error) {
      Logger.warn(
        `Invalid or expired admin token: ${error.message} `,
        AdminAuthService.name,
      );
      return false;
    }
  }
}
