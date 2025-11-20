import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/models/users.model';
import { PostStatus } from '../schemas/posts.schema';

registerEnumType(PostStatus, {
  name: 'PostStatus',
  description: 'The status of the post (e.g., published or archived)',
});


@ObjectType()
export class MediaItem {
  @Field()
  url: string;

  @Field()
  type: string;
}

@ObjectType()
export class Post {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => User)
  author: User; // Ce champ nécessitera un "field resolver"

  @Field(() => Int)
  likesCount: number; // Ce champ nécessitera un "field resolver"

  @Field(() => Int)
  commentsCount: number; // Ce champ nécessitera un "field resolver"

  @Field(() => Int)
  viewsCount: number;

  @Field(() => Int)
  sharesCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Boolean, { nullable: true, description: "Indicates if the current user has liked this post. Null if no user is logged in." })
  isLiked?: boolean;

  @Field(() => Boolean, { nullable: true, description: "Indicates if the current user has bookmarked this post. Null if no user is logged in." })
  isBookmarked?: boolean;

  @Field(() => [MediaItem], { nullable: 'itemsAndList' })
  media?: MediaItem[];

  @Field(() => PostStatus)
  status: PostStatus;
}