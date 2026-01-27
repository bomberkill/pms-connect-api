import { Resolver, Mutation, Args, Query, ID } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupGQL } from './models/group.model';
import { CreateGroupInput } from './dto/create-group.input';
import { GetGroupsArgs } from './dto/get-groups.args';
import { UpdateGroupInput } from './dto/update-group.input';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { GroupDocument, GroupMemberRole } from './schemas/group.schema';

@Resolver(() => GroupGQL)
export class GroupsResolver {
  constructor(private readonly groupsService: GroupsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => GroupGQL, { name: 'createGroup' })
  async createGroup(
    @Args('createGroupInput') createGroupInput: CreateGroupInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupDocument> {
    return this.groupsService.create(createGroupInput, currentUser);
  }

  @Query(() => GroupGQL, { name: 'getGroupBySlug', nullable: true })
  async getGroupBySlug(
    @Args('slug', { type: () => String }) slug: string,
  ): Promise<GroupDocument | null> {
    // Privacy checks can be added here or in the service later
    return this.groupsService.findBySlug(slug);
  }

  @Query(() => GroupGQL, { name: 'getGroupById', nullable: true })
  async getGroupById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GroupDocument | null> {
    return this.groupsService.findGroupById(id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => GroupGQL, { name: 'updateGroup' })
  async updateGroup(
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('updateGroupInput') updateGroupInput: UpdateGroupInput,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<GroupDocument> {
    // Logic moved to service
    return this.groupsService.update(groupId, currentUser._id.toString(), updateGroupInput);
  }

  @UseGuards(FirebaseAuthGuard)
  @Mutation(() => GroupGQL, { name: 'leaveOrRemoveMemberFromGroup' })
  async leaveOrRemoveMember(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
    @Args('userIdToRemove', { type: () => ID, nullable: true }) userIdToRemove?: string,
  ): Promise<GroupDocument> {
    // Logic moved to service
    return this.groupsService.removeMember(groupId, currentUser._id.toString(), userIdToRemove);
  }

  // This query is public, but in a real app you might want to filter out SECRET groups
  @Query(() => [GroupGQL], { name: 'getGroups' })
  async getGroups(@Args() args: GetGroupsArgs): Promise<GroupDocument[]> {
    return this.groupsService.findAll(args);
  }
}
