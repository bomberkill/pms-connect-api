import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommentStatus, MediaType } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PaginationArgs } from './dto/pagination.args';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { CreateCommentInput } from './dto/create-comment.input';

// Media used to be an embedded Mongoose array — it's a separate Prisma
// table now, so every query returning a Comment to a caller needs this.
const WITH_MEDIA = { media: true } as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async addComment(authorId: string, createCommentInput: CreateCommentInput) {
    const post = await this.prisma.post.findUnique({
      where: { id: createCommentInput.postId },
      select: { id: true, authorId: true },
    });
    if (!post) {
      throw new NotFoundException(
        `Post with ID "${createCommentInput.postId}" not found.`,
      );
    }

    const { media, parentId, postId, content } = createCommentInput;

    const [savedComment] = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.CommentUncheckedCreateInput = {
        postId,
        authorId,
        content,
        parentId: parentId || null,
        ...(media && {
          media: {
            create: media.map((m) => ({ ...m, type: m.type as MediaType })),
          },
        }),
      };
      const comment = await tx.comment.create({ data, include: WITH_MEDIA });

      if (!parentId) {
        await tx.post.update({
          where: { id: postId },
          data: { commentsCount: { increment: 1 } },
        });
      } else {
        await tx.comment.update({
          where: { id: parentId },
          data: { repliesCount: { increment: 1 } },
        });
      }

      return [comment];
    });

    this.pubSub.publish('COMMENT_ADDED', {
      commentAdded: createCommentInput.postId,
    });

    this.notificationsService.create({
      recipients: [post.authorId],
      sender: authorId,
      type: NotificationType.POST_COMMENT,
      entityId: post.id,
      onModel: 'Post',
    });

    return savedComment;
  }

  async removeComment(commentId: string, userId: string): Promise<boolean> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found.`);
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments.');
    }

    await this.softDeleteCommentAndReplies(commentId);
    return true;
  }

  async removeCommentAsAdmin(commentId: string): Promise<boolean> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found.`);
    }
    await this.softDeleteCommentAndReplies(commentId);
    return true;
  }

  /**
   * Recursively soft-deletes a comment and all its replies.
   */
  private async softDeleteCommentAndReplies(commentId: string): Promise<void> {
    const replies = await this.prisma.comment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });

    for (const reply of replies) {
      await this.softDeleteCommentAndReplies(reply.id);
    }

    const deletedComment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: '[This comment has been deleted]',
        status: CommentStatus.DELETED,
      },
    });

    if (deletedComment.parentId) {
      await this.prisma.comment.update({
        where: { id: deletedComment.parentId },
        data: { repliesCount: { decrement: 1 } },
      });
    } else {
      await this.prisma.post.update({
        where: { id: deletedComment.postId },
        data: { commentsCount: { decrement: 1 } },
      });
    }
  }

  async findCommentsByPost(
    postId: string,
    paginationArgs: PaginationArgs,
    includeDeleted = false,
  ) {
    const { skip, limit } = paginationArgs;
    return this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
        ...(includeDeleted ? {} : { status: CommentStatus.VISIBLE }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: WITH_MEDIA,
    });
  }

  async findRepliesForComment(
    parentId: string,
    paginationArgs: PaginationArgs,
    includeDeleted = false,
  ) {
    const { skip, limit } = paginationArgs;
    return this.prisma.comment.findMany({
      where: {
        parentId,
        ...(includeDeleted ? {} : { status: CommentStatus.VISIBLE }),
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: WITH_MEDIA,
    });
  }

  async findOne(id: string, includeDeleted = false) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: WITH_MEDIA,
    });
    if (comment && !includeDeleted && comment.status === CommentStatus.DELETED) {
      return null;
    }
    return comment;
  }

  async findManyByIds(ids: readonly string[]) {
    return this.prisma.comment.findMany({
      where: { id: { in: [...ids] } },
      include: WITH_MEDIA,
    });
  }

  /**
   * Lean lookup used to resolve a comment's parent post before checking
   * group-content visibility (e.g. for getCommentReplies, which is only
   * given a comment id).
   */
  async findPostIdForComment(commentId: string): Promise<string | null> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { postId: true },
    });
    return comment?.postId ?? null;
  }
}
