import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';
import { Group, GroupMemberRole } from './group.schema';

export type GroupMembershipDocument = GroupMembership & Document;

@Schema({ timestamps: { createdAt: 'joinedAt', updatedAt: false } })
export class GroupMembership {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  })
  group: Group;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user: User;

  @Prop({
    type: String,
    enum: Object.values(GroupMemberRole),
    required: true,
    default: GroupMemberRole.MEMBER,
  })
  role: GroupMemberRole;

  readonly joinedAt: Date;
}

export const GroupMembershipSchema =
  SchemaFactory.createForClass(GroupMembership);

// Compound unique index to prevent duplicate memberships
GroupMembershipSchema.index({ group: 1, user: 1 }, { unique: true });

// Index for querying members by role
GroupMembershipSchema.index({ group: 1, role: 1 });
