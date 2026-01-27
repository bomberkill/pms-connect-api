import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';

export enum NotificationType {
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  CONNECTION_REQUEST = 'CONNECTION_REQUEST',
  CONNECTION_ACCEPTED = 'CONNECTION_ACCEPTED',
  POST_LIKE = 'POST_LIKE',
  COMMENT_LIKE = 'COMMENT_LIKE',
  POST_COMMENT = 'POST_COMMENT',
  GROUP_JOIN_REQUEST = 'GROUP_JOIN_REQUEST',
  GROUP_JOIN_REQUEST_ACCEPTED = 'GROUP_JOIN_REQUEST_ACCEPTED',
  GROUP_INVITATION = 'GROUP_INVITATION',
  
}

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  // L'utilisateur qui reçoit la notification
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  recipient: User;

  // L'utilisateur qui a déclenché la notification (ex: celui qui a aimé le post)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  sender: User;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  // L'entité liée à la notification (le Post, le Commentaire, etc.)
  // `refPath` permet une référence dynamique à différents modèles.
  @Prop({ type: SchemaTypes.ObjectId, refPath: 'onModel' })
  entityId: string;

  @Prop({ type: String, enum: ['Post', 'User', 'Comment', 'Group'] })
  onModel: string;

  @Prop({ type: Boolean, default: false, index: true })
  read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);