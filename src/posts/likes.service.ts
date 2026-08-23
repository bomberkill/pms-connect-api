import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';

type LikeableType = 'Post' | 'Comment';

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async likeItem(
    likeableId: string,
    likeableType: LikeableType,
    userId: string,
  ): Promise<boolean> {
    const isPost = likeableType === 'Post';

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findFirst({
        where: isPost
          ? { userId, postId: likeableId }
          : { userId, commentId: likeableId },
      });
      if (existing) {
        return null; // already liked — no-op, same as the old upsert's "like !== null" branch
      }

      await tx.like.create({
        data: isPost
          ? { userId, postId: likeableId }
          : { userId, commentId: likeableId },
      });

      const item = isPost
        ? await tx.post.update({
            where: { id: likeableId },
            data: { likesCount: { increment: 1 } },
            select: { id: true, authorId: true, likesCount: true },
          })
        : await tx.comment.update({
            where: { id: likeableId },
            data: { likesCount: { increment: 1 } },
            select: { id: true, authorId: true, likesCount: true },
          });

      return item;
    });

    if (result) {
      this.pubSub.publish('LIKES_UPDATED', {
        likesUpdated: {
          likeableId,
          likeableType,
          likesCount: result.likesCount,
        },
      });

      if (result.authorId !== userId) {
        this.notificationsService.create({
          recipients: [result.authorId],
          sender: userId,
          type:
            likeableType === 'Post'
              ? NotificationType.POST_LIKE
              : NotificationType.COMMENT_LIKE,
          entityId: result.id,
          onModel: likeableType,
        });
      }
    }

    return true;
  }

  async unlikeItem(
    likeableId: string,
    likeableType: LikeableType,
    userId: string,
  ): Promise<boolean> {
    const isPost = likeableType === 'Post';

    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.like.deleteMany({
        where: isPost
          ? { userId, postId: likeableId }
          : { userId, commentId: likeableId },
      });

      if (deleted.count === 0) return null;

      return isPost
        ? tx.post.update({
            where: { id: likeableId },
            data: { likesCount: { decrement: 1 } },
            select: { likesCount: true },
          })
        : tx.comment.update({
            where: { id: likeableId },
            data: { likesCount: { decrement: 1 } },
            select: { likesCount: true },
          });
    });

    if (result) {
      this.pubSub.publish('LIKES_UPDATED', {
        likesUpdated: {
          likeableId,
          likeableType,
          likesCount: result.likesCount,
        },
      });
    }

    return true;
  }

  /**
   * Checks which items from a given list have been liked by a specific user.
   * Essential for the LikeLoader.
   */
  async findUserLikesForItems(
    keys: readonly { likeableId: string; likeableType: string }[],
    userId: string,
  ): Promise<Set<string>> {
    const postIds = keys
      .filter((k) => k.likeableType === 'Post')
      .map((k) => k.likeableId);
    const commentIds = keys
      .filter((k) => k.likeableType === 'Comment')
      .map((k) => k.likeableId);

    const likes = await this.prisma.like.findMany({
      where: {
        userId,
        OR: [
          ...(postIds.length ? [{ postId: { in: postIds } }] : []),
          ...(commentIds.length ? [{ commentId: { in: commentIds } }] : []),
        ],
      },
      select: { postId: true, commentId: true },
    });

    return new Set(likes.map((like) => like.postId ?? like.commentId));
  }
}
