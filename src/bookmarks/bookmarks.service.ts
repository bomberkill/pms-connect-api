import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookmarkableType } from './schemas/bookmark.schema';
import { PostsService } from 'src/posts/posts.service';
import { CommentsService } from 'src/posts/comments.service';
import { PaginationArgs } from 'src/posts/dto/pagination.args';
import { BookmarkLoaderKey } from './loaders/bookmarks.loader';

@Injectable()
export class BookmarksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
    @Inject(forwardRef(() => CommentsService))
    private readonly commentsService: CommentsService,
  ) {}

  /**
   * Ajoute un item (Post ou Comment) aux favoris d'un utilisateur.
   */
  async addBookmark(
    userId: string,
    itemId: string,
    itemType: BookmarkableType,
  ): Promise<boolean> {
    const isPost = itemType === BookmarkableType.POST;

    // Valider que l'item à mettre en favori existe
    if (isPost) {
      await this.postsService.findOne(itemId);
    } else {
      await this.commentsService.findOne(itemId);
    }

    try {
      await this.prisma.bookmark.create({
        data: isPost
          ? { userId, postId: itemId }
          : { userId, commentId: itemId },
      });
      return true;
    } catch (error) {
      // Unique constraint violation — already bookmarked (race condition).
      if (error.code === 'P2002') {
        return true;
      }
      throw error;
    }
  }

  /**
   * Supprime un item des favoris d'un utilisateur.
   */
  async removeBookmark(userId: string, itemId: string): Promise<boolean> {
    const result = await this.prisma.bookmark.deleteMany({
      where: { userId, OR: [{ postId: itemId }, { commentId: itemId }] },
    });

    if (result.count === 0) {
      throw new NotFoundException('Bookmark not found.');
    }

    return true;
  }

  /**
   * Récupère la liste des favoris pour un utilisateur.
   */
  async findUserBookmarks(userId: string, paginationArgs: PaginationArgs) {
    return this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: paginationArgs.skip,
      take: paginationArgs.limit,
      include: {
        post: { include: { media: true } },
        comment: { include: { media: true } },
      },
    });
  }

  /**
   * Checks which items from a given list have been bookmarked by a specific user.
   * Essential for the BookmarkLoader.
   */
  async findUserBookmarkedItems(
    keys: readonly BookmarkLoaderKey[],
  ): Promise<Set<string>> {
    const userId = keys[0]?.userId;
    if (!userId) return new Set();

    const itemIds = keys.map((k) => k.itemId);
    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        userId,
        OR: [{ postId: { in: itemIds } }, { commentId: { in: itemIds } }],
      },
      select: { postId: true, commentId: true },
    });
    return new Set(
      bookmarks.map((bookmark) => bookmark.postId ?? bookmark.commentId),
    );
  }
}
