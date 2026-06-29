import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';

// --- Enums ---

export enum GroupPrivacy {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  SECRET = 'SECRET',
}

export enum GroupMemberRole {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

// --- Main Schema ---

@Schema({ timestamps: true })
export class Group {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  slug: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  creator: User;

  @Prop({
    type: String,
    enum: Object.values(GroupPrivacy),
    required: true,
    default: GroupPrivacy.PUBLIC,
  })
  privacy: GroupPrivacy;

  @Prop({ type: String })
  coverImageUrl?: string;

  @Prop({ type: String })
  profileImageUrl?: string;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
export type GroupDocument = Group & Document;
