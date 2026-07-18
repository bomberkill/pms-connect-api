import { Resolver, Mutation, Args, ID, Query } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { GroupJoinRequestGQL } from './models/group-join-request.model';
import {
  GroupJoinRequestDocument,
  GroupJoinRequestStatus,
} from './schemas/group-join-request.schema';
import { GetGroupJoinRequestsArgs } from './dto/get-join-requests.args';
import {
  JoinGroupRequestsService,
  PopulatedGroupJoinRequest,
} from './join-group-requests.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { RespondToGroupJoinRequestInput } from './dto/respond-to-group-join-request.input';
import { GetMyGroupJoinRequestsArgs } from './dto/get-my-group-join-requests.args';

@Resolver(() => GroupJoinRequestGQL)
export class JoinGroupRequestsResolver {
  constructor(
    private readonly requestsService: JoinGroupRequestsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'requestToJoinGroup',
    description:
      'Requests to join a group or joins immediately when the group is public.',
  })
  async requestToJoinGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.sendJoinRequest(
      groupId,
      currentUser.id,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => GroupJoinRequestGQL, {
    name: 'addOrInviteGroupMember',
    nullable: true,
    description:
      'Adds a member directly when allowed, or creates an invitation for private groups.',
  })
  async addOrInviteGroupMember(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupJoinRequestDocument | null> {
    return this.requestsService.inviteUserToGroup(
      groupId,
      userId,
      currentUser.id,
    );
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'approveGroupJoinRequest',
    description: 'Approves a pending group join request.',
  })
  async approveGroupJoinRequest(
    @Args('input') input: RespondToGroupJoinRequestInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.acceptJoinRequest(
      input.requestId,
      currentUser.id,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'rejectGroupJoinRequest',
    description: 'Rejects a pending join request as a group admin or moderator.',
  })
  async rejectGroupJoinRequest(
    @Args('input') input: RespondToGroupJoinRequestInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.rejectJoinRequest(
      input.requestId,
      currentUser.id,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'cancelGroupJoinRequest',
    description: 'Cancels the current user pending join request.',
  })
  async cancelGroupJoinRequest(
    @Args('input') input: RespondToGroupJoinRequestInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.cancelJoinRequest(
      input.requestId,
      currentUser.id,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'acceptGroupInvitation',
    description: 'Accepts a group invitation for the current user.',
  })
  async acceptGroupInvitation(
    @Args('input') input: RespondToGroupJoinRequestInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.acceptGroupInvitation(
      input.requestId,
      currentUser.id,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'declineGroupInvitation',
    description: 'Declines a group invitation for the current user.',
  })
  async declineGroupInvitation(
    @Args('input') input: RespondToGroupJoinRequestInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.declineGroupInvitation(
      input.requestId,
      currentUser.id,
    );
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [GroupJoinRequestGQL], { name: 'getGroupJoinRequests' })
  async getGroupJoinRequests(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('status', {
      type: () => GroupJoinRequestStatus,
      nullable: true,
      defaultValue: GroupJoinRequestStatus.PENDING,
    })
    status: GroupJoinRequestStatus,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<PopulatedGroupJoinRequest[]> {
    return this.requestsService.findRequestsForGroup(
      groupId,
      currentUser.id,
      status,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [GroupJoinRequestGQL], { name: 'adminGetGroupJoinRequests' })
  async adminGetGroupJoinRequests(
    @Args() args: GetGroupJoinRequestsArgs,
  ): Promise<PopulatedGroupJoinRequest[]> {
    return this.requestsService.findAll(args);
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => Boolean, { name: 'adminApproveGroupJoinRequest' })
  async adminApproveGroupJoinRequest(
    @Args('input') input: RespondToGroupJoinRequestInput,
  ): Promise<boolean> {
    await this.requestsService.adminApproveJoinRequest(input.requestId);
    return true;
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => Boolean, { name: 'adminRejectGroupJoinRequest' })
  async adminRejectGroupJoinRequest(
    @Args('input') input: RespondToGroupJoinRequestInput,
  ): Promise<boolean> {
    await this.requestsService.adminRejectJoinRequest(input.requestId);
    return true;
  }

  @UseGuards(BetterAuthGuard)
  @Query(() => [GroupJoinRequestGQL], { name: 'getMyGroupJoinRequests' })
  async getMyGroupJoinRequests(
    @Args() args: GetMyGroupJoinRequestsArgs,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<PopulatedGroupJoinRequest[]> {
    return this.requestsService.findRequestsForUser(
      currentUser.id,
      args,
    );
  }
  // TODO: Add groupJoinRequestUpdated subscription
}
