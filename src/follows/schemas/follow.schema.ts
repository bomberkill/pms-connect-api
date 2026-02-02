import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';

export type FollowDocument = Follow & Document;

@Schema({ timestamps: true })
export class Follow {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  follower: User; // User who follows

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  following: User; // User being followed

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

// Compound unique index to prevent duplicate follows
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
