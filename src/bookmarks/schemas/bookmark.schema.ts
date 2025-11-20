import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Comment } from 'src/posts/schemas/comments.schema';
import { Post } from 'src/posts/schemas/posts.schema';
import { User } from 'src/users/schemas/users.schema';

export enum BookmarkableType {
  POST = 'Post',
  COMMENT = 'Comment',
}

export type BookmarkDocument = Bookmark & Document;

@Schema({
  timestamps: { createdAt: true, updatedAt: false }, // On ne garde que createdAt
  collection: 'bookmarks',
})
export class Bookmark {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  user: User;

  @Prop({ type: String, required: true, enum: Object.values(BookmarkableType) })
  itemType: BookmarkableType;

  @Prop({ type: SchemaTypes.ObjectId, required: true, refPath: 'itemType' })
  item: Post | Comment;
}

export const BookmarkSchema = SchemaFactory.createForClass(Bookmark);

// Index unique pour empêcher un utilisateur de mettre en favori le même item plusieurs fois.
BookmarkSchema.index({ user: 1, item: 1, itemType: 1 }, { unique: true });