import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BookmarkableType, BookmarkDocument } from './schemas/bookmark.schema';
import { Bookmark, BookmarkableItemUnion } from './models/bookmark.model';
import { PaginationArgs } from 'src/posts/dto/pagination.args';
import { UserDocument } from 'src/users/schemas/users.schema';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { BookmarksService } from './bookmarks.service';

@Resolver(() => Bookmark)
export class BookmarksResolver {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'addBookmark' })
  async addBookmark(
    @CurrentUser() user: UserDocument,
    @Args('itemId', { type: () => ID }) itemId: string,
    @Args('itemType', { type: () => BookmarkableType })
    itemType: BookmarkableType,
  ): Promise<boolean> {
    return this.bookmarksService.addBookmark(user._id.toString(), itemId, itemType);
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'removeBookmark' })
  async removeBookmark(
    @CurrentUser() user: UserDocument,
    @Args('itemId', { type: () => ID }) itemId: string,
  ): Promise<boolean> {
    return this.bookmarksService.removeBookmark(user._id.toString(), itemId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Query(() => [Bookmark], { name: 'myBookmarks' })
  async getMyBookmarks(
    @CurrentUser() user: UserDocument,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<BookmarkDocument[]> {
    return this.bookmarksService.findUserBookmarks(
      user._id.toString(),
      paginationArgs,
    );
  }

  @ResolveField('item', () => BookmarkableItemUnion)
  resolveItem(@Parent() bookmark: BookmarkDocument): any {
    return bookmark.item;
  }
}
