import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

// Define potential roles for your admin users
export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CONTENT_MODERATOR = 'CONTENT_MODERATOR',
  USER_MANAGER = 'USER_MANAGER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  // Add other roles as needed
}

@Schema({ timestamps: true }) // Enables createdAt and updatedAt
export class AdminUser extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string; // Hashed password

  @Prop({ type: String, required: true, trim: true })
  name: string; // Full name, or you could split into firstName/lastName

  @Prop({
    type: [String],
    enum: Object.values(AdminRole),
    required: true,
    default: [AdminRole.SUPPORT_AGENT],
  })
  roles: AdminRole[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, nullable: true })
  lastLoginAt?: Date; // Changed from lastLogin for consistency

  @Prop({ type: Number, default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Boolean, default: false })
  isLockedOut: boolean;

  @Prop({ type: [String], default: [] })
  permissions: string[]; // For fine-grained permissions beyond roles

  @Prop({ type: String, nullable: true, select: false }) // select: false to not return it by default
  passwordResetToken?: string;

  @Prop({ type: Date, nullable: true, select: false }) // select: false
  passwordResetExpires?: Date;

  // createdAt and updatedAt are automatically added by timestamps: true
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Method to compare
  comparePassword: (password: string) => Promise<boolean>;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

AdminUserSchema.methods.comparePassword = async function (
  attempt: string,
): Promise<boolean> {
  return bcrypt.compare(attempt, this.passwordHash);
};
// Middleware to hash password before saving
AdminUserSchema.pre<AdminUserDocument>('save', async function (next) {
  if (this.isModified('passwordHash') || this.isNew) {
    // Only hash if password is new or modified to avoid re-hashing
    if (!this.passwordHash.startsWith('$2b$')) {
      // Simple check to see if it's already hashed
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
  }
  next();
});

export type AdminUserDocument = AdminUser & Document;
