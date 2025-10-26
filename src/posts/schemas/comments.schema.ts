import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';
import { Post, MediaItem, MediaItemSchema } from './posts.schema';

export enum CommentStatus {
  VISIBLE = 'VISIBLE',
  DELETED = 'DELETED',
}


export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  author: User;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true, index: true })
  post: Post;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comment', default: null })
  parent?: Comment;

  @Prop({ type: Number, default: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0 })
  commentsCount: number;

  @Prop({ type: [MediaItemSchema], default: [] })
  media: MediaItem[];

  @Prop({type: String, enum: CommentStatus, default: CommentStatus.VISIBLE})
  status: CommentStatus;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);