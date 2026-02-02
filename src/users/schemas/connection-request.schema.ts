import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from './users.schema';

export enum ConnectionRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  TERMINATED = 'TERMINATED',
}

@Schema({ timestamps: true })
export class ConnectionRequest extends Document {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  requester: User;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  recipient: User;

  @Prop({
    type: String,
    enum: Object.values(ConnectionRequestStatus),
    default: ConnectionRequestStatus.PENDING,
    index: true,
  })
  status: ConnectionRequestStatus;
}

export const ConnectionRequestSchema =
  SchemaFactory.createForClass(ConnectionRequest);
export type ConnectionRequestDocument = ConnectionRequest & Document;
