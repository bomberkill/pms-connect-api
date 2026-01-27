import { Resolver, Mutation, Args, ID, Query } from '@nestjs/graphql';
import { UseGuards, Inject, ForbiddenException } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { GroupJoinRequestGQL } from './models/group-join-request.model';
import {
  GroupJoinRequestDocument,
  GroupJoinRequestStatus,
} from './schemas/group-join-request.schema';
import { GetGroupJoinRequestsArgs } from './dto/get-join-requests.args';
import { JoinGroupRequestsService } from './join-group-requests.service';
import { PUB_SUB } from '../pubsub/pubsub.module';

@Resolver(() => GroupJoinRequestGQL)
export class JoinGroupRequestsResolver {
  constructor(
    private readonly requestsService: JoinGroupRequestsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'sendGroupJoinRequest' })
  async sendGroupJoinRequest(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.sendJoinRequest(groupId, currentUser._id.toString());
    return true;
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => GroupJoinRequestGQL, {
    name: 'inviteOrAddUserToGroup',
    nullable: true,
    description: 'Allows an admin/moderator to invite or directly add a user to a group.',
  })
  async inviteOrAddUserToGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('userIdToInvite', { type: () => ID }) userIdToInvite: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupJoinRequestDocument | null> {
    return this.requestsService.inviteUserToGroup(groupId, userIdToInvite, currentUser._id.toString());
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'acceptGroupJoinRequest' })
  async acceptGroupJoinRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.acceptJoinRequest(requestId, currentUser._id.toString());
    return true;
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => Boolean, { name: 'declineOrCancelGroupJoinRequest' })
  async declineOrCancelGroupJoinRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.requestsService.declineOrCancelJoinRequest(
      requestId,
      currentUser._id.toString(),
    );
    return true;
  }

  @UseGuards(FirebaseAuthGuard)
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
  ): Promise<GroupJoinRequestDocument[]> {
    return this.requestsService.findRequestsForGroup(groupId, currentUser._id.toString(), status);
  }

  // This is a powerful query, likely for platform admins.
  // It should be protected by a more specific guard in a real app (e.g., AdminAuthGuard).
  @UseGuards(FirebaseAuthGuard)
  @Query(() => [GroupJoinRequestGQL], { name: 'getAllGroupJoinRequests' })
  async getAllGroupJoinRequests(@Args() args: GetGroupJoinRequestsArgs): Promise<GroupJoinRequestDocument[]> {
    return this.requestsService.findAll(args);
  }
  // TODO: Add groupJoinRequestUpdated subscription
}