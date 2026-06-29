import {
  Resolver,
  Mutation,
  Args,
  Query,
  ID,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupGQL, GroupMemberGQL } from './models/group.model';
import { CreateGroupInput } from './dto/create-group.input';
import { GetGroupsArgs } from './dto/get-groups.args';
import { UpdateGroupInput } from './dto/update-group.input';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { GroupDocument } from './schemas/group.schema';
import { User } from '../users/models/users.model';
import { Dataloader } from '../dataloader/dataloader.decorator';
import { UserLoader } from '../users/loaders/users.loader';
import { GroupMembershipService } from './group-membership.service';
import { GroupMembershipDocument } from './schemas/group-membership.schema';
import { GroupMembershipGQL } from './models/group-membership.model';
import { GetGroupMembersArgs } from './dto/get-group-members.args';
import { UpdateGroupMemberRoleInput } from './dto/update-group-member-role.input';

@Resolver(() => GroupGQL)
export class GroupsResolver {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly membershipService: GroupMembershipService,
  ) {}

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => GroupGQL, { name: 'createGroup' })
  async createGroup(
    @Args('createGroupInput') createGroupInput: CreateGroupInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupDocument> {
    return this.groupsService.create(createGroupInput, currentUser);
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => GroupGQL, { name: 'getGroupBySlug', nullable: true })
  async getGroupBySlug(
    @Args('slug', { type: () => String }) slug: string,
  ): Promise<GroupDocument | null> {
    // Privacy checks can be added here or in the service later
    return this.groupsService.findBySlug(slug);
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => GroupGQL, { name: 'getGroupById', nullable: true })
  async getGroupById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GroupDocument | null> {
    return this.groupsService.findGroupById(id);
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => GroupGQL, { name: 'updateGroup' })
  async updateGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('updateGroupInput') updateGroupInput: UpdateGroupInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupDocument> {
    // Logic moved to service
    return this.groupsService.update(
      groupId,
      currentUser._id.toString(),
      updateGroupInput,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => GroupGQL, {
    name: 'leaveGroup',
    description: 'Allows the current user to leave a group.',
  })
  async leaveGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupDocument> {
    return this.groupsService.removeMember(groupId, currentUser._id.toString());
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => GroupGQL, {
    name: 'removeGroupMember',
    description: 'Allows an authorized member to remove another member.',
  })
  async removeGroupMember(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupDocument> {
    return this.groupsService.removeMember(
      groupId,
      currentUser._id.toString(),
      userId,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => GroupMembershipGQL, {
    name: 'updateGroupMemberRole',
    description: 'Allows a group admin to update a member role.',
  })
  async updateGroupMemberRole(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('updateGroupMemberRoleInput')
    updateGroupMemberRoleInput: UpdateGroupMemberRoleInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupMembershipDocument> {
    return this.groupsService.updateMemberRole(
      groupId,
      currentUser._id.toString(),
      updateGroupMemberRoleInput.userId,
      updateGroupMemberRoleInput.role,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Mutation(() => Boolean, {
    name: 'deleteGroup',
    description: 'Allows the group creator to delete the group.',
  })
  async deleteGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    return this.groupsService.delete(groupId, currentUser._id.toString());
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => [GroupGQL], { name: 'getGroups' })
  async getGroups(@Args() args: GetGroupsArgs): Promise<GroupDocument[]> {
    return this.groupsService.findAll(args);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [GroupGQL], { name: 'adminGetGroups' })
  async adminGetGroups(@Args() args: GetGroupsArgs): Promise<GroupDocument[]> {
    return this.groupsService.findAll(args);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => GroupGQL, { name: 'adminGetGroupById', nullable: true })
  async adminGetGroupById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GroupDocument | null> {
    return this.groupsService.findGroupById(id);
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => GroupGQL, { name: 'adminUpdateGroup' })
  async adminUpdateGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('updateGroupInput') updateGroupInput: UpdateGroupInput,
  ): Promise<GroupDocument> {
    return this.groupsService.adminUpdate(groupId, updateGroupInput);
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => [GroupMembershipGQL], { name: 'getGroupMembers' })
  async getGroupMembers(
    @Args() args: GetGroupMembersArgs,
  ): Promise<GroupMembershipDocument[]> {
    const { groupId, ...paginationArgs } = args;
    return this.membershipService.getMembers(groupId, paginationArgs);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [GroupMembershipGQL], { name: 'adminGetGroupMembers' })
  async adminGetGroupMembers(
    @Args() args: GetGroupMembersArgs,
  ): Promise<GroupMembershipDocument[]> {
    const { groupId, ...paginationArgs } = args;
    return this.membershipService.getMembers(groupId, paginationArgs);
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => GroupGQL, { name: 'adminRemoveGroupMember' })
  async adminRemoveGroupMember(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<GroupDocument> {
    return this.groupsService.adminRemoveMember(groupId, userId);
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => GroupMembershipGQL, { name: 'adminUpdateGroupMemberRole' })
  async adminUpdateGroupMemberRole(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('updateGroupMemberRoleInput')
    updateGroupMemberRoleInput: UpdateGroupMemberRoleInput,
  ): Promise<GroupMembershipDocument> {
    return this.groupsService.adminUpdateMemberRole(
      groupId,
      updateGroupMemberRoleInput.userId,
      updateGroupMemberRoleInput.role,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Mutation(() => Boolean, { name: 'adminDeleteGroup' })
  async adminDeleteGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
  ): Promise<boolean> {
    return this.groupsService.adminDelete(groupId);
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => GroupMembershipGQL, {
    name: 'getMyGroupMembership',
    nullable: true,
  })
  async getMyGroupMembership(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupMembershipDocument | null> {
    return this.membershipService.getMembershipWithGroup(
      groupId,
      currentUser._id.toString(),
    );
  }

  // --- Field Resolvers ---

  @ResolveField('creator', () => User)
  async getCreator(
    @Parent() group: GroupDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<User> {
    const creatorId =
      typeof group.creator === 'string'
        ? group.creator
        : (group.creator as any)._id.toString();
    const user = await userLoader.load(creatorId);
    return user as unknown as User;
  }

  @ResolveField('members', () => [GroupMemberGQL])
  async getMembers(
    @Parent() group: GroupDocument,
    @Dataloader(UserLoader) userLoader: UserLoader,
  ): Promise<GroupMemberGQL[]> {
    const memberships = await this.membershipService.getMembers(group._id.toString(), {
      skip: 0,
      limit: Number.MAX_SAFE_INTEGER,
    });

    return Promise.all(
      memberships.map(async (membership) => {
        const userId =
          typeof membership.user === 'string'
            ? membership.user
            : (membership.user as any)._id.toString();
        const user = await userLoader.load(userId);
        return {
          role: membership.role,
          joinedAt: membership.joinedAt,
          user: user as unknown as User,
        };
      }),
    );
  }
}
