import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminUserDocument } from './admin-user.schema';
import { CreateAdminUserInput } from './dto/create-admin-user.input';
import { UpdateAdminUserInput } from './dto/update-admin-user.input';

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(
    createAdminUserInput: CreateAdminUserInput,
  ): Promise<AdminUserDocument> {
    const { email, password, ...restOfInput } = createAdminUserInput;

    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { email },
    });
    if (existingAdmin) {
      throw new ConflictException(
        `Admin user with email "${email}" already exists.`,
      );
    }

    // Mongoose used to hash this in a pre-save hook — Prisma has no such
    // hook, so the hashing happens explicitly here instead.
    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.adminUser.create({
      data: { email, passwordHash, ...restOfInput },
    });
  }

  async findAll(): Promise<AdminUserDocument[]> {
    return this.prisma.adminUser.findMany();
  }

  async findById(id: string): Promise<AdminUserDocument | null> {
    return this.prisma.adminUser.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<AdminUserDocument | null> {
    return this.prisma.adminUser.findUnique({ where: { email } });
  }

  async comparePassword(admin: AdminUserDocument, attempt: string): Promise<boolean> {
    return bcrypt.compare(attempt, admin.passwordHash);
  }

  async recordLogin(id: string): Promise<AdminUserDocument> {
    return this.prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async createPasswordResetToken(admin: AdminUserDocument): Promise<string> {
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before saving to DB for security (store only the hash)
    const passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const expiresInMinutes = this.configService.get<number>(
      'ADMIN_PASSWORD_RESET_TOKEN_DB_EXPIRES_IN_MINUTES',
      15,
    );
    const passwordResetExpires = new Date(
      Date.now() + expiresInMinutes * 60 * 1000,
    );

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordResetToken, passwordResetExpires },
    });

    return resetToken; // Return the unhashed token to be sent via email
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<AdminUserDocument> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await this.prisma.adminUser.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!admin) {
      throw new NotFoundException(
        'Password reset token is invalid or has expired.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    return this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0, // Reset failed attempts
        isLockedOut: false, // Unlock account if it was locked
      },
    });
  }

  async update(
    id: string,
    updateAdminUserInput: UpdateAdminUserInput,
  ): Promise<AdminUserDocument> {
    try {
      return await this.prisma.adminUser.update({
        where: { id },
        data: updateAdminUserInput,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Admin user with ID "${id}" not found.`);
      }
      throw error;
    }
  }

  // Implement soft delete or permanent delete as needed
  // async delete(id: string): Promise<AdminUserDocument> { ... }
}
