import {
  Parent,
  ResolveField,
  Resolver,
  Mutation,
  Query,
  Args,
  ID,
  Int,
  Subscription,
} from '@nestjs/graphql';
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
import {
  CurrentUser,
  CurrentUserType,
  isAdminUser,
} from 'src/auth/decorators/current-user.decorator';
import { CombinedAuthGuard } from 'src/auth/guards/combined-auth.guard';
import { AdminAuthGuard } from 'src/admin-auth/guards/admin-auth.guard';
import { GqlWsAuthGuard } from 'src/auth/guards/gql-ws-auth.guard';
import { PaginationArgs } from './dto/pagination.args';
import { PUB_SUB } from 'src/pubsub/pubsub.module';
import { BookmarkLoader } from 'src/bookmarks/loaders/bookmarks.loader';
import { CommentsService } from './comments.service';
import { PostsService } from './posts.service';
import { GroupsService } from 'src/groups/groups.service';

@Resolver(() => Comment)
export class CommentsResolver {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly postsService: PostsService,
    private readonly groupsService: GroupsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) { }

  /**
   * Comments never carry a groupId themselves — visibility is inherited
   * from their parent post's group, if any. No-op when the post isn't
   * attached to a group.
   */
  private async assertPostGroupVisible(
    postId: string,
    currentUser: CurrentUserType,
  ): Promise<void> {
    const groupId = await this.postsService.findGroupIdForPost(postId);
    if (groupId) {
      await this.groupsService.assertCanViewGroupContent(groupId, currentUser);
    }
  }

  // --- Query ---

  @UseGuards(CombinedAuthGuard)
  @Query(() => [Comment], { name: 'getCommentsByPost' })
  async getCommentsByPost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args() paginationArgs: PaginationArgs,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CommentDocument[]> {
    await this.assertPostGroupVisible(postId, currentUser);
    return this.commentsService.findCommentsByPost(postId, paginationArgs);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [Comment], { name: 'adminGetCommentsByPost' })
  async adminGetCommentsByPost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args() paginationArgs: PaginationArgs,
  ): Promise<CommentDocument[]> {
    return this.commentsService.findCommentsByPost(
      postId,
      paginationArgs,
      true,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => [Comment], { name: 'getCommentReplies' })
  async getCommentReplies(
    @Args('parentId', { type: () => ID }) parentId: string,
    @Args() paginationArgs: PaginationArgs,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CommentDocument[]> {
    const postId = await this.commentsService.findPostIdForComment(parentId);
    if (postId) {
      await this.assertPostGroupVisible(postId, currentUser);
    }
    return this.commentsService.findRepliesForComment(parentId, paginationArgs);
  }

  @UseGuards(CombinedAuthGuard) // Protéger la lecture pour s'assurer que l'utilisateur est connecté
  @Query(() => Comment, { name: 'getCommentById', nullable: true })
  async getCommentById(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CommentDocument | null> {
    const comment = await this.commentsService.findOne(id, isAdminUser(currentUser));
    if (comment) {
      await this.assertPostGroupVisible(comment.postId, currentUser);
    }
    return comment;
  }

  // --- Mutations ---

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => Comment, { name: 'addComment' })
  async addComment(
    @Args('createCommentInput') createCommentInput: CreateCommentInput,
    @CurrentUser() user: UserDocument,
  ): Promise<CommentDocument> {
    return this.commentsService.addComment(
      user.id,
      createCommentInput,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => Boolean, { name: 'removeComment' })
  async removeComment(
    @Args('commentId', { type: () => ID }) commentId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.commentsService.removeComment(commentId, user.id);
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => Boolean, { name: 'adminRemoveComment' })
  async adminRemoveComment(
    @Args('commentId', { type: () => ID }) commentId: string,
  ): Promise<boolean> {
    return this.commentsService.removeCommentAsAdmin(commentId);
  }

  // --- Subscription ---

  @UseGuards(GqlWsAuthGuard)
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
  commentAdded(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('postId', { type: () => ID }) _postId: string,
  ) {
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
    return userLoader.load(comment.authorId);
  }

  /**
   * Résout le champ 'post' pour un commentaire.
   */
  // Prisma's Comment column is `repliesCount` (renamed during the SQL
  // migration to disambiguate from Post.commentsCount); the GraphQL field
  // stays `commentsCount` to avoid a frontend-facing schema break.
  @ResolveField('commentsCount', () => Int)
  resolveCommentsCount(@Parent() comment: CommentDocument): number {
    return comment.repliesCount;
  }

  @ResolveField('post', () => Post)
  async getPost(
    @Parent() comment: CommentDocument,
    @Dataloader(PostLoader) postLoader: PostLoader,
  ): Promise<PostDocument> {
    return postLoader.load(comment.postId);
  }

  @ResolveField('parent', () => Comment, { nullable: true })
  async getParent(
    @Parent() comment: CommentDocument,
    @Dataloader(CommentLoader) commentLoader: CommentLoader,
  ): Promise<CommentDocument | null> {
    if (!comment.parentId) {
      return null;
    }
    return commentLoader.load(comment.parentId);
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
    const key: LikeLoaderKey = {
      likeableId: comment.id,
      likeableType: 'Comment',
      userId: user.id,
    };
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
      userId: user.id,
      itemId: comment.id,
    });
  }
}
