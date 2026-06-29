import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Date, Model } from 'mongoose';
import { Post, PostDocument, PostStatus } from './schemas/posts.schema'; // Corrected path if needed
import { Like, LikeDocument } from './schemas/likes.schema';
import { CreatePostInput } from './dto/create-post.input';
import { PaginationArgs } from './dto/pagination.args';
import { UpdatePostInput } from './dto/update-post.input';
import { NotificationsService } from '../notifications/notifications.service';
import { PUB_SUB } from 'src/pubsub/pubsub.module';
import { PubSub } from 'graphql-subscriptions';
import { CommentsService } from './comments.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    // Injection du service de notifications
    private readonly notificationsService: NotificationsService,
    private readonly commentsService: CommentsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // Note: For transactions to work, you must be connected to a MongoDB replica set.

  async create(
    createPostInput: CreatePostInput,
    authorId: string,
  ): Promise<PostDocument> {
    const newPost = new this.postModel({
      ...createPostInput,
      author: authorId,
    });
    return (await newPost.save()).populate('author');
  }

  async findManyByIds(ids: readonly string[]): Promise<PostDocument[]> {
    return this.postModel.find({ _id: { $in: ids } }).exec();
  }

  async findOne(id: string): Promise<PostDocument> {
    const post = await this.postModel.findById(id).populate('author').exec();
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }
    return post;
  }

  async update(
    id: string,
    userId: string,
    updatePostInput: UpdatePostInput,
  ): Promise<PostDocument> {
    const post = await this.postModel.findById(id);

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }

    if (post.author.toString() !== userId) {
      throw new ForbiddenException('You can only update your own posts.');
    }

    // Mongoose ne met à jour que les champs fournis dans l'objet
    Object.assign(post, updatePostInput);

    const updatedPost = await post.save();

    // On s'assure que l'auteur est toujours populé au retour
    return updatedPost.populate('author');
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const post = await this.postModel.findById(id);

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }

    // Autoriser la suppression uniquement si l'utilisateur est l'auteur du post.
    // (On pourrait ajouter une logique pour les administrateurs ici)
    if (post.author.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own posts.');
    }

    return this.softDeletePost(id);
  }

  /**
   * Finds posts from a list of author IDs to build a feed.
   * @param authorIds - An array of user IDs.
   * @param paginationArgs - Skip and limit for pagination.
   * @returns A paginated list of posts.
   */
  async findPostsByAuthors(
    authorIds: string[],
    paginationArgs: PaginationArgs,
  ): Promise<PostDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.postModel
      .find({
        author: { $in: authorIds }, // Find posts where the author is in the provided list
      })
      .sort({ createdAt: -1 }) // Show newest posts first
      .skip(skip)
      .limit(limit)
      .populate('author');
  }

  /**
   * Finds the most popular authors based on likes received in the last 60 days.
   * This uses a MongoDB aggregation pipeline.
   * @param limit - The number of popular authors to return.
   * @returns A list of the most popular author IDs.
   */
  async findPopularAuthors(limit = 20): Promise<string[]> {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const popularAuthors = await this.postModel.aggregate([
      // 1. Match posts from the last 60 days
      { $match: { createdAt: { $gte: sixtyDaysAgo } } },
      // 2. Group by author and sum their total likes
      { $group: { _id: '$author', totalLikes: { $sum: '$likesCount' } } },
      // 3. Sort authors by the most likes
      { $sort: { totalLikes: -1 } },
      // 4. Take the top N authors
      { $limit: limit },
      // 5. We only need the author ID
      { $project: { _id: 1 } },
    ]);

    // The result is an array of objects like [{ _id: '...' }], so we map to get an array of strings.
    return popularAuthors.map((author) => author._id.toString());
  }

  /**
   * Finds all posts on the platform, for general discovery.
   * @param paginationArgs - Skip and limit for pagination.
   * @returns A paginated list of all posts.
   */
  async findAllPosts(paginationArgs: PaginationArgs): Promise<PostDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.postModel
      .find() // No filter, gets all posts
      .sort({ createdAt: -1 }) // Show newest posts first
      .skip(skip)
      .limit(limit)
      .populate('author');
  }

  /**
   * Counts new posts from a list of authors since a given post ID.
   * @param authorIds - An array of user IDs.
   * @param sincePostId - The ID of the last post seen by the user.
   * @returns The number of new posts.
   */
  async countNewPostsByAuthors(
    authorIds: string[],
    sincePostId: string,
  ): Promise<number> {
    return this.postModel.countDocuments({
      author: { $in: authorIds },
      _id: { $gt: sincePostId }, // Efficiently checks for newer documents
      status: PostStatus.PUBLISHED,
    });
  }

  /**
   * Counts all new posts on the platform since a given post ID.
   */
  async countNewPosts(since: Date): Promise<number> {
    return this.postModel.countDocuments({
      createdAt: { $gt: since },
      status: PostStatus.PUBLISHED,
    });
  }
  /**
   * Finds posts belonging to a specific group.
   * @param groupId - The ID of the group.
   * @param paginationArgs - Skip and limit for pagination.
   * @returns A paginated list of posts in the group.
   */
  async findPostsByGroup(
    groupId: string,
    paginationArgs: PaginationArgs,
  ): Promise<PostDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.postModel
      .find({ group: groupId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author');
  }

  async removeAsAdmin(id: string): Promise<boolean> {
    const post = await this.postModel.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found.`);
    }

    return this.softDeletePost(id);
  }

  private async softDeletePost(id: string): Promise<boolean> {
    await this.postModel.findByIdAndUpdate(id, {
      $set: {
        status: PostStatus.ARCHIVED,
        content: '[This post has been deleted]',
      },
    });

    const topLevelComments = await this.commentsService.findCommentsByPost(id, {
      skip: 0,
      limit: Number.MAX_SAFE_INTEGER,
    });

    for (const comment of topLevelComments) {
      await this.commentsService.removeCommentAsAdmin(comment._id.toString());
    }

    return true;
  }
}
