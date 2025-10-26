import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { User } from '../../users/schemas/users.schema';

export enum PostStatus {
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ _id: false })
export class MediaItem {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true, enum: ['IMAGE', 'VIDEO', 'DOCUMENT'] })
  type: string;
}
export const MediaItemSchema = SchemaFactory.createForClass(MediaItem);

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  author: User;

  @Prop({ type: Number, default: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0 })
  commentsCount: number;

  @Prop({ type: Number, default: 0 })
  viewsCount: number;

  @Prop({ type: Number, default: 0 })
  sharesCount: number;

  @Prop({ type: [MediaItemSchema], default: [] })
  media: MediaItem[];
  
  @Prop({type: String, enum: PostStatus, default: PostStatus.PUBLISHED})
  status: PostStatus;

  // Add declarations for timestamp fields to satisfy TypeScript
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Les likes, commentaires, etc., sont gérés dans des collections séparées pour la scalabilité.
}

export const PostSchema = SchemaFactory.createForClass(Post);