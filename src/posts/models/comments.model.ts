import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { User } from 'src/users/models/users.model';
import { MediaItem, Post } from './posts.model';
import { CommentStatus } from '../schemas/comments.schema'; 

registerEnumType(CommentStatus, {
  name: 'CommentStatus',
  description: 'The status of the comment (e.g., visible or deleted)',
});

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => User)
  author: User;

  @Field(() => Post)
  post: Post; // Ce champ nécessitera un "field resolver"

  @Field(() => Comment, { nullable: true })
  parent?: Comment;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Int)
  likesCount: number;

  @Field(() => Int)
  commentsCount: number;

  @Field(() => [MediaItem], { nullable: 'itemsAndList' })
  media?: MediaItem[];

  @Field(() => Boolean, { nullable: true, description: "Indicates if the current user has liked this comment. Null if no user is logged in." })
  isLiked?: boolean;

  @Field(() => Boolean, { nullable: true, description: "Indicates if the current user has bookmarked this comment. Null if no user is logged in." })
  isBookmarked?: boolean;

  @Field(() => CommentStatus)
  status: CommentStatus;
}