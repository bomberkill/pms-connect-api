import {
  Field,
  ID,
  ObjectType,
  GraphQLISODateTime,
  createUnionType,
  registerEnumType,
} from '@nestjs/graphql';
import { Comment } from 'src/posts/models/comments.model';
import { Post } from 'src/posts/models/posts.model';
import { BookmarkableType } from '../schemas/bookmark.schema';

registerEnumType(BookmarkableType, {
  name: 'BookmarkableType',
});

export const BookmarkableItemUnion = createUnionType({
  name: 'BookmarkableItemUnion',
  types: () => [Post, Comment] as const,
  resolveType: (value) => {
    // Comment's FK is postId (a Comment always belongs to a Post); Post has
    // no such field, so this reliably distinguishes the two.
    if ('postId' in value) {
      return 'Comment';
    }
    return 'Post';
  },
});

@ObjectType()
export class Bookmark {
  @Field(() => ID)
  id: string;

  @Field(() => BookmarkableItemUnion)
  item: typeof BookmarkableItemUnion;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}
