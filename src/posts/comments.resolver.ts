import { Parent, ResolveField, Resolver, Mutation, Query, Args, ID, Subscription } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Comment } from './models/comments.model';
import { UserDocument } from 'src/users/schemas/users.schema';
import { CommentDocument } from './schemas/comments.schema';
import { PostDocument } from './schemas/posts.schema';

// Ces imports sont des suppositions, ajustez les chemins si nécessaire
import { Dataloader } from 'src/dataloader/dataloader.decorator';
import { UserLoader } from 'src/users/loaders/users.loader';
import { PostLoader } from './loaders/posts.loader';
import { CommentLoader } from './loaders/comments.loader';
import { LikeLoader, LikeLoaderKey } from './loaders/likes.loader';
import { User } from 'src/users/models/users.model';
import { Post } from './models/posts.model';
import { CreateCommentInput } from './dto/create-comment.input';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { PaginationArgs } from './dto/pagination.args';
import { PUB_SUB } from 'src/pubsub/pubsub.module';
import { BookmarkLoader } from 'src/bookmarks/loaders/bookmarks.loader';
import { CommentsService } from './comments.service';

@Resolver(() => Comment)
export class CommentsResolver {
  constructor(
    private readonly commentsService: CommentsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // --- Query ---

  @UseGuards(FirebaseAuthGuard)
  @Query(() => [Comment], { name: 'getCommentsByPost' })
  async getCommentsByPost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<CommentDocument[]> {
    return this.commentsService.findCommentsByPost(postId, paginationArgs);
  }

  @UseGuards(FirebaseAuthGuard)
  @Query(() => [Comment], { name: 'getCommentReplies' })
  async getCommentReplies(
    @Args('parentId', { type: () => ID }) parentId: string,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<CommentDocument[]> {
    return this.commentsService.findRepliesForComment(parentId, paginationArgs);
  }

  @UseGuards(FirebaseAuthGuard) // Protéger la lecture pour s'assurer que l'utilisateur est connecté
  @Query(() => Comment, { name: 'getCommentById', nullable: true })
  async getCommentById(@Args('id', { type: () => ID }) id: string): Promise<CommentDocument> {
    return this.commentsService.findOne(id);
  }

  // --- Mutations ---

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Comment, { name: 'addComment' })
  async addComment(
    @Args('createCommentInput') createCommentInput: CreateCommentInput,
    @CurrentUser() user: UserDocument,
  ): Promise<CommentDocument> {
    // const { postId, content, parentId, media } = createCommentInput;
    return this.commentsService.addComment(user._id.toString(), createCommentInput);
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'removeComment' })
  async removeComment(
    @Args('commentId', { type: () => ID }) commentId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.commentsService.removeComment(commentId, user._id.toString());
  }

  // --- Subscription ---

  @Subscription(() => String, {
    name: 'commentAdded',
    filter: (payload, variables) => {
      // payload: { commentAdded: CommentDocument }
      // variables: { postId: string }
      // On ne notifie que les clients qui écoutent le bon post.
      return payload.commentAdded === variables.postId;
    },
    resolve: (payload) => payload.commentAdded, // On extrait le commentaire du payload
  })
  // @UseGuards(FirebaseAuthGuard) // Protège l'accès à la subscription
  commentAdded(@Args('postId', { type: () => ID }) postId: string) {
    return this.pubSub.asyncIterableIterator('COMMENT_ADDED');
  }

  /**
   * Résout le champ 'author' pour un commentaire.
   * Utilise un Dataloader pour récupérer l'auteur de manière optimisée.
   */
  @ResolveField('author', () => User)
  async getAuthor(
    @Parent() comment: CommentDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<UserDocument> {
    return userLoader.load(comment.author.toString());
  }

  /**
   * Résout le champ 'post' pour un commentaire.
   */
  @ResolveField('post', () => Post)
  async getPost(
    @Parent() comment: CommentDocument,
    @Dataloader(PostLoader) postLoader: PostLoader,
  ): Promise<PostDocument> {
    return postLoader.load(comment.post.toString());
  }

  @ResolveField('parent', () => Comment, { nullable: true })
  async getParent(
    @Parent() comment: CommentDocument,
    @Dataloader(CommentLoader) commentLoader: CommentLoader,
  ): Promise<CommentDocument | null> {
    if (!comment.parent) {
      return null;
    }
    return commentLoader.load(comment.parent.toString());
  }

  /**
   * Résout le champ 'isLiked' pour un commentaire.
   * Indique si l'utilisateur courant a aimé ce commentaire.
   * Retourne null si l'utilisateur n'est pas authentifié.
   */
  @ResolveField('isLiked', () => Boolean, { nullable: true })
  async isLiked(
    @Parent() comment: CommentDocument,
    @CurrentUser() user: UserDocument | null,
    @Dataloader(LikeLoader) likeLoader: LikeLoader,
  ): Promise<boolean | null> {
    if (!user) {
      return null;
    }
    const key: LikeLoaderKey = { likeableId: comment._id.toString(), likeableType: 'Comment', userId: user._id.toString() };
    return likeLoader.load(key);
  }

  @ResolveField('isBookmarked', () => Boolean, { nullable: true })
  async isBookmarked(
    @Parent() comment: CommentDocument,
    @CurrentUser() user: UserDocument | null,
    @Dataloader(BookmarkLoader) bookmarkLoader: BookmarkLoader,
  ): Promise<boolean | null> {
    if (!user) {
      return null;
    }
    return bookmarkLoader.load({
      userId: user._id.toString(),
      itemId: comment._id.toString(),
    });
  }
}