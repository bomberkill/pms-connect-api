import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Bookmark,
  BookmarkableType,
  BookmarkDocument,
} from './schemas/bookmark.schema';
import { Model, Types } from 'mongoose';
import { PostsService } from 'src/posts/posts.service';
import { CommentsService } from 'src/posts/comments.service';
import { PaginationArgs } from 'src/posts/dto/pagination.args';
import { BookmarkLoaderKey } from './loaders/bookmarks.loader';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectModel(Bookmark.name) private bookmarkModel: Model<BookmarkDocument>,
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
    // 1. Valider que l'item à mettre en favori existe
    if (itemType === BookmarkableType.POST) {
      await this.postsService.findOne(itemId); // Lance une NotFoundException si non trouvé
    } else if (itemType === BookmarkableType.COMMENT) {
      await this.commentsService.findOne(itemId); // Lance une NotFoundException si non trouvé
    }

    const query = {
      user: userId,
      item: new Types.ObjectId(itemId),
      itemType: itemType,
    };

    try {
      await this.bookmarkModel.updateOne(
        query,
        { $setOnInsert: query },
        { upsert: true },
      );
      return true;
    } catch (error) {
      // Le code 11000 correspond à une violation de l'index unique dans MongoDB
      if (error.code === 11000) {
        // Si l'upsert échoue à cause d'une race condition, l'item est déjà en favori.
        return true;
      }
      throw error;
    }
  }

  /**
   * Supprime un item des favoris d'un utilisateur.
   */
  async removeBookmark(userId: string, itemId: string): Promise<boolean> {
    const result = await this.bookmarkModel.deleteOne({
      user: userId,
      item: new Types.ObjectId(itemId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Bookmark not found.');
    }

    return true;
  }

  /**
   * Récupère la liste des favoris pour un utilisateur.
   */
  async findUserBookmarks(
    userId: string,
    paginationArgs: PaginationArgs,
  ): Promise<BookmarkDocument[]> {
    return this.bookmarkModel
      .find({ user: userId })
      .sort({ createdAt: -1 }) // Les plus récents en premier
      .skip(paginationArgs.skip)
      .limit(paginationArgs.limit)
      .populate('item') // Très important: récupère les détails du Post ou Comment
      .exec();
  }
  /**
   * Checks which items from a given list have been bookmarked by a specific user.
   * Essential for the BookmarkLoader.
   * @param keys - An array of { userId, itemId } objects.
   * @returns A Set of itemIds that the user has bookmarked.
   */
  async findUserBookmarkedItems(
    keys: readonly BookmarkLoaderKey[],
  ): Promise<Set<string>> {
    const userId = keys[0]?.userId;
    if (!userId) return new Set();

    const itemIds = keys.map((k) => k.itemId);
    const bookmarks = await this.bookmarkModel
      .find({
        user: userId,
        item: { $in: itemIds },
      })
      .select('item')
      .lean();
    return new Set(bookmarks.map((bookmark) => bookmark.item.toString()));
  }
}
