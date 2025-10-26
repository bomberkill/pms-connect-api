import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { Post, PostDocument, PostStatus } from './schemas/posts.schema';
import { Comment, CommentDocument, CommentStatus } from './schemas/comments.schema';
import { PaginationArgs } from './dto/pagination.args';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { CreateCommentInput } from './dto/create-comment.input';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async addComment(authorId: string, createCommentInput: CreateCommentInput): Promise<CommentDocument> {
    const post = await this.postModel.findById(createCommentInput.postId).select('_id author').lean();
    if (!post) {
      throw new NotFoundException(`Post with ID "${createCommentInput.postId}" not found.`);
    }

    let savedComment: CommentDocument;
    const session = await this.commentModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        const newComment = new this.commentModel({
          post: createCommentInput.postId,
          author: authorId,
          content: createCommentInput.content,
          media: createCommentInput.media,
          parent: createCommentInput.parentId || null,
        });

        // Save the comment within the transaction
        savedComment = await newComment.save({ session });

        if (!createCommentInput.parentId) {
          // Only increment commentsCount for top-level comments
          await this.postModel.updateOne({ _id: createCommentInput.postId }, { $inc: { commentsCount: 1 } }, { session });
        } else {
          // If it's a reply, increment the commentsCount of the parent comment
          await this.commentModel.updateOne({ _id: createCommentInput.parentId }, { $inc: { commentsCount: 1 } }, { session });
        }
      }); // The transaction is automatically committed here if no errors were thrown.

      // The transaction was successful, now we can perform side-effects.
      // Populate the author details. This happens outside the transaction but before the session ends.
      // await savedComment;
      
      // Publish the event for GraphQL subscriptions
      this.pubSub.publish('COMMENT_ADDED', { commentAdded: createCommentInput.postId });

      // Create the notification AFTER the transaction has succeeded.
      this.notificationsService.create({
        recipients: [post.author.toString()],
        sender: authorId,
        type: NotificationType.POST_COMMENT,
        entityId: post._id.toString(),
        onModel: 'Post',
      });

      return savedComment;
    } finally {
      // The session is automatically ended by withTransaction, but it's good practice to ensure it.
      await session.endSession();
    }
  }

  async removeComment(commentId: string, userId: string): Promise<boolean> {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found.`);
    }
    if (comment.author.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own comments.');
    }

    // Start recursive soft-delete
    await this.softDeleteCommentAndReplies(commentId);

    return true;
  }

  /**
   * Recursively soft-deletes a comment and all its replies.
   * @param commentId The ID of the comment to start deleting from.
   */
  private async softDeleteCommentAndReplies(commentId: string): Promise<void> {
    // Find all direct replies to the current comment
    const replies = await this.commentModel.find({ parent: commentId }).select('_id').lean();

    // Recursively delete each reply
    for (const reply of replies) {
      await this.softDeleteCommentAndReplies(reply._id.toString());
    }

    // Soft-delete the current comment
    const deletedComment = await this.commentModel.findByIdAndUpdate(
      commentId,
      {
        $set: {
          content: '[This comment has been deleted]',
          status: CommentStatus.DELETED,
          // Optionally clear author to anonymize, but keep it for historical data
          // author: null 
        }
      },
      { new: true }
    );

    // Decrement the post's comment count only for top-level comments
    if (deletedComment) {
      if(deletedComment.parent) {
        // If it's a reply, decrement the commentsCount of the parent comment
        await this.commentModel.updateOne({ _id: deletedComment.parent }, { $inc: { commentsCount: -1 } });
      } else {
        // If it's a top-level comment, decrement the commentsCount of the post
        await this.postModel.updateOne({ _id: deletedComment.post }, { $inc: { commentsCount: -1 } });
      }
    }
  }

  async findCommentsByPost(postId: string, paginationArgs: PaginationArgs): Promise<CommentDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.commentModel
      .find({ post: postId, parent: null }) // Only fetch top-level comments
      .sort({ createdAt: -1 }) // Show newest comments first
      .skip(skip)
      .limit(limit)
      // .lean({ virtuals: true }); // Use .lean() for performance, and include virtuals like 'id'
  }

  async findRepliesForComment(parentId: string, paginationArgs: PaginationArgs): Promise<CommentDocument[]> {
    const { skip, limit } = paginationArgs;
    return this.commentModel
      .find({ parent: parentId }) // Fetch replies for a specific parent
      .sort({ createdAt: 'asc' }) // Show oldest replies first for conversational flow
      .skip(skip)
      .limit(limit)
      // .lean({ virtuals: true }); // Use .lean() for performance, and include virtuals like 'id'
  }

  async findOne(id: string): Promise<CommentDocument> {
    return this.commentModel.findById(id).exec();
  }

  async findManyByIds(ids: readonly string[]): Promise<CommentDocument[]> {
    return this.commentModel.find({ _id: { $in: ids } }).exec();
  }
}