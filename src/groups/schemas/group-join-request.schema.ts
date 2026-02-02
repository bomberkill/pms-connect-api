import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';
import { Group } from './group.schema';

export enum GroupJoinRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  INVITED = 'INVITED',
}

@Schema({ timestamps: true })
export class GroupJoinRequest extends Document {
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
    enum: Object.values(GroupJoinRequestStatus),
    default: GroupJoinRequestStatus.PENDING,
    index: true,
  })
  status: GroupJoinRequestStatus;
}

export const GroupJoinRequestSchema =
  SchemaFactory.createForClass(GroupJoinRequest);
export type GroupJoinRequestDocument = GroupJoinRequest & Document;
