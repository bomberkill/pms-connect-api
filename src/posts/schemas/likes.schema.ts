import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/users.schema';
import { Post } from './posts.schema';

export type LikeDocument = Like & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Like {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  user: User;

  // @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true, index: true })
  // post: Post;

  @Prop({type: SchemaTypes.ObjectId, required: true, index: true})
  likeableId: Types.ObjectId;

  @Prop({type: String, required: true, index: true, enum: ['Post', 'Comment']})
  likeableType: string;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
LikeSchema.index({ user: 1, likeableId: 1, likeableType: 1}, { unique: true }); // Un utilisateur ne peut aimer un post qu'une seule fois