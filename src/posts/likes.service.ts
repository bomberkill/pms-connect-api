import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { Post, PostDocument } from './schemas/posts.schema';
import { Like, LikeDocument } from './schemas/likes.schema';
import { Comment, CommentDocument } from './schemas/comments.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';

@Injectable()
export class LikesService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async likeItem(
    likeableId: string,
    likeableType: 'Post' | 'Comment',
    userId: string,
  ): Promise<boolean> {
    const { model, item } = await this.getLikeableItem(
      likeableId,
      likeableType,
    );

    const session = await this.likeModel.db.startSession();
    session.startTransaction();
    try {
      const query = { likeableId, likeableType, user: userId };

      const like = await this.likeModel.findOneAndUpdate(
        query,
        { $setOnInsert: query },
        { upsert: true, new: false, session: session },
      );

      let newLikesCount = item.likesCount;
      if (like === null) {
        // A new like was created
        newLikesCount++;
        await model.updateOne(
          { _id: likeableId },
          { $inc: { likesCount: 1 } },
          { session },
        );
      }

      await session.commitTransaction();

      if (like === null) {
        // Publish the update
        this.pubSub.publish('LIKES_UPDATED', {
          likesUpdated: { likeableId, likeableType, likesCount: newLikesCount },
        });

        // Create notification only for new likes
        if (item.author.toString() !== userId) {
          this.notificationsService.create({
            recipients: [item.author.toString()],
            sender: userId,
            type:
              likeableType === 'Post'
                ? NotificationType.POST_LIKE
                : NotificationType.COMMENT_LIKE, // Assuming COMMENT_LIKE exists
            entityId: item._id.toString(),
            onModel: likeableType,
          });
        }
      }

      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async unlikeItem(
    likeableId: string,
    likeableType: 'Post' | 'Comment',
    userId: string,
  ): Promise<boolean> {
    const { model } = await this.getLikeableItem(likeableId, likeableType);

    const session = await this.likeModel.db.startSession();
    session.startTransaction();
    try {
      const result = await this.likeModel
        .deleteOne({ likeableId, likeableType, user: userId })
        .session(session);

      if (result.deletedCount > 0) {
        const updatedItem = await model.findOneAndUpdate(
          { _id: likeableId },
          { $inc: { likesCount: -1 } },
          { session, new: true },
        );
        // Publish the update
        this.pubSub.publish('LIKES_UPDATED', {
          likesUpdated: {
            likeableId,
            likeableType,
            likesCount: updatedItem.likesCount,
          },
        });
      }

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Checks which posts from a given list have been liked by a specific user.
   * Essential for the LikeLoader. Now generic for any likeable type.
   * @param keys - An array of { likeableId, likeableType } objects.
   * @param userId - The ID of the user.
   * @returns A Set of likeableIds that the user has liked.
   */
  async findUserLikesForItems(
    keys: readonly { likeableId: string; likeableType: string }[],
    userId: string,
  ): Promise<Set<string>> {
    const likeableIds = keys.map((k) => k.likeableId);
    const likes = await this.likeModel
      .find({
        likeableId: { $in: likeableIds },
        // We can assume the likeableType is the same for a batch, but this is safer
        likeableType: { $in: [...new Set(keys.map((k) => k.likeableType))] },
        user: userId,
      })
      .select('likeableId')
      .lean();

    return new Set(likes.map((like) => like.likeableId.toString()));
  }

  private async getLikeableItem(
    id: string,
    type: 'Post' | 'Comment',
  ): Promise<{
    model: Model<PostDocument | CommentDocument>;
    item: PostDocument | CommentDocument;
  }> {
    let model: Model<PostDocument | CommentDocument>;
    if (type === 'Post') {
      model = this.postModel as Model<PostDocument | CommentDocument>;
    } else if (type === 'Comment') {
      model = this.commentModel as Model<PostDocument | CommentDocument>;
    } else {
      throw new NotFoundException(`Likeable type "${type}" not supported.`);
    }
    const item = await model
      .findById(id)
      .select('_id author likesCount')
      .lean();
    if (!item) {
      throw new NotFoundException(`${type} with ID "${id}" not found.`);
    }
    return { model, item };
  }
}
