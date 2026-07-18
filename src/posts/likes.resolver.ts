import { Resolver, Mutation, Args, ID, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { LikesService } from './likes.service';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { LikesUpdate } from './models/likes-update.model';
import { PUB_SUB } from 'src/pubsub/pubsub.module';

@Resolver()
export class LikesResolver {
  constructor(
    private readonly likesService: LikesService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'likePost' })
  async likePost(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.likesService.likeItem(postId, 'Post', user.id);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'unlikePost' })
  async unlikePost(
    @Args('postId', { type: () => ID }) postId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.likesService.unlikeItem(postId, 'Post', user.id);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'likeComment' })
  async likeComment(
    @Args('commentId', { type: () => ID }) commentId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.likesService.likeItem(
      commentId,
      'Comment',
      user.id,
    );
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'unlikeComment' })
  async unlikeComment(
    @Args('commentId', { type: () => ID }) commentId: string,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.likesService.unlikeItem(
      commentId,
      'Comment',
      user.id,
    );
  }

  @Subscription(() => LikesUpdate, {
    name: 'likesUpdated',
    filter: (payload, variables) =>
      payload.likesUpdated.likeableId.toString() === variables.likeableId &&
      payload.likesUpdated.likeableType === variables.likeableType,
    resolve: (payload) => payload.likesUpdated,
  })
  // @UseGuards(BetterAuthGuard)
  likesUpdated(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('likeableId', { type: () => ID }) _likeableId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Args('likeableType', { type: () => String }) _likeableType: string,
  ) {
    return this.pubSub.asyncIterableIterator('LIKES_UPDATED');
  }
}
