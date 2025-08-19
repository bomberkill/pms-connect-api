import {
    Injectable,
    ConflictException,
    NotFoundException,
  } from '@nestjs/common';
  import { ConfigService } from '@nestjs/config';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model } from 'mongoose';
  import { AdminUser, AdminUserDocument, AdminRole } from './admin-user.schema';
  import { CreateAdminUserInput } from './dto/create-admin-user.input';
  import { UpdateAdminUserInput } from './dto/update-admin-user.input';
  import * as crypto from 'crypto';

@Injectable()
export class AdminsService {
    constructor(
        @InjectModel(AdminUser.name) private adminUserModel: Model<AdminUserDocument>,
        private configService: ConfigService,
    ) {}
    
    async create(
    createAdminUserInput: CreateAdminUserInput,
    ): Promise<AdminUserDocument> {
    const { email, password, ...restOfInput } = createAdminUserInput;

    const existingAdmin = await this.adminUserModel.findOne({ email }).exec();
    if (existingAdmin) {
        throw new ConflictException(
        `Admin user with email "${email}" already exists.`,
        );
    }

    // The password will be hashed by the pre-save hook in admin-user.schema.ts
    // We pass the plain password to the 'passwordHash' field of the schema.
    const newAdmin = new this.adminUserModel({
        email,
        passwordHash: password, // Schema's pre-save hook will hash this
        ...restOfInput,
    });

        return newAdmin.save();
    }

    async findAll(): Promise<AdminUserDocument[]> {
        return this.adminUserModel.find().exec();
    }

    async findById(id: string): Promise<AdminUserDocument | null> {
        return this.adminUserModel.findById(id).exec();
    }

    async findByEmail(email: string): Promise<AdminUserDocument | null> {
        return this.adminUserModel.findOne({ email }).exec();
    }

    async createPasswordResetToken(admin: AdminUserDocument): Promise<string> {
        const resetToken = crypto.randomBytes(32).toString('hex');
    
        // Hash the token before saving to DB for security (store only the hash)
        admin.passwordResetToken = crypto
          .createHash('sha256')
          .update(resetToken)
          .digest('hex');
    
          const expiresInMinutes = this.configService.get<number>('ADMIN_PASSWORD_RESET_TOKEN_DB_EXPIRES_IN_MINUTES', 15);
          admin.passwordResetExpires = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    
        await admin.save({ validateBeforeSave: false }); // Skip validation for these fields
    
        return resetToken; // Return the unhashed token to be sent via email
      }

    async resetPassword(token: string, newPassword: string): Promise<AdminUserDocument> {
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const admin = await this.adminUserModel.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!admin) {
            throw new NotFoundException('Password reset token is invalid or has expired.');
        }

        admin.passwordHash = newPassword; // The pre-save hook will hash this
        admin.passwordResetToken = undefined;
        admin.passwordResetExpires = undefined;
        admin.failedLoginAttempts = 0; // Reset failed attempts
        admin.isLockedOut = false; // Unlock account if it was locked
        return admin.save();
    }


    async update(
    id: string,
    updateAdminUserInput: UpdateAdminUserInput,
    ): Promise<AdminUserDocument> {
    const existingAdmin = await this.adminUserModel
        .findByIdAndUpdate(id, { $set: updateAdminUserInput }, { new: true })
        .exec();

    if (!existingAdmin) {
        throw new NotFoundException(`Admin user with ID "${id}" not found.`);
    }
        return existingAdmin;
    }

    // Implement soft delete or permanent delete as needed
    // async delete(id: string): Promise<AdminUserDocument> { ... }
}
