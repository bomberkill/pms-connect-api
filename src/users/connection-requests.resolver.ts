import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Subscription,
} from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from './schemas/users.schema';
import { User } from './models/users.model';
import { ConnectionRequestGQL } from './models/connection-request.model';
import {
  ConnectionRequestDocument,
  ConnectionRequestStatus,
} from './schemas/connection-request.schema';
import { ConnectionRequestsService } from './connection-requests.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { ConnectionRequestForSubscriptionGQL } from './models/connection-update-subscription.model';
import { GetConnectionRequestsArgs } from './dto/get-connection-requests.args';
import { PaginationArgs } from '../posts/dto/pagination.args';

@Resolver(() => ConnectionRequestGQL)
export class ConnectionRequestsResolver {
  constructor(
    private readonly connectionRequestsService: ConnectionRequestsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'sendConnectionRequest' })
  async sendConnectionRequest(
    @Args('recipientId', { type: () => ID }) recipientId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.connectionRequestsService.sendConnectionRequest(
      currentUser._id.toString(),
      recipientId,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'acceptConnectionRequest' })
  async acceptConnectionRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.connectionRequestsService.acceptConnectionRequest(
      requestId,
      currentUser._id.toString(),
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, { name: 'declineOrCancelConnectionRequest' })
  async declineOrCancelConnectionRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.connectionRequestsService.declineOrCancelConnectionRequest(
      requestId,
      currentUser._id.toString(),
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [ConnectionRequestGQL], { name: 'getMyConnectionRequests' })
  async getMyConnectionRequests(
    @CurrentUser() currentUser: UserDocument,
    @Args('status', {
      type: () => ConnectionRequestStatus,
      nullable: true,
      description: 'Filter requests by status (e.g., PENDING)',
    })
    status?: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDocument[]> {
    return this.connectionRequestsService.findConnectionRequestsForUser(
      currentUser._id.toString(),
      status,
    );
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [User], { name: 'getConnections' })
  async getConnections(
    @Args('userId', { type: () => ID }) userId: string,
    @Args() { skip, limit }: PaginationArgs,
  ): Promise<UserDocument[]> {
    return this.connectionRequestsService.getConnections(userId, skip, limit);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [ConnectionRequestGQL], { name: 'adminGetConnectionRequests' })
  async adminGetConnectionRequests(
    @Args() args: GetConnectionRequestsArgs,
  ): Promise<ConnectionRequestDocument[]> {
    return this.connectionRequestsService.adminFindAll(args);
  }

  @Subscription(() => ConnectionRequestForSubscriptionGQL, {
    name: 'connectionRequestUpdated',
    nullable: true,
    filter: (payload, variables, context) => {
      // The context contains the user object attached by the guard
      const currentUserId = context.user?._id?.toString();
      if (!currentUserId) {
        console.log('currentUserId not found ', context.user);
        return false;
      }

      if (!payload || !payload.connectionRequestUpdated) {
        console.log('payload not found or malformed');
        return false;
      }
      const { requester, recipient } = payload.connectionRequestUpdated;
      // Notify if the current user is either the requester or the recipient
      console.log(
        `Filtering subscription for user ${currentUserId}. Requester: ${requester}, Recipient: ${recipient}`,
      );
      return (
        requester.toString() === currentUserId ||
        recipient.toString() === currentUserId
      );
    },
    resolve: (payload) => {
      console.log(
        'payload found: ',
        payload,
        ' and payload.connectionRequestUpdated: ',
        payload?.connectionRequestUpdated,
      );
      return payload.connectionRequestUpdated;
    },
  })
  // @UseGuards(BetterAuthGuard) // Important to get user in context
  connectionRequestUpdated() {
    // The user must be authenticated to subscribe, but we don't need to filter by a specific ID here.
    // The `filter` function above will handle the logic based on the authenticated user's ID.
    return this.pubSub.asyncIterableIterator('CONNECTION_REQUEST_UPDATED');
  }
}
