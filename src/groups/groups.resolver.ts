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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { GroupDocument } from './schemas/group.schema';
import { User } from '../users/models/users.model';
import { Dataloader } from '../dataloader/dataloader.decorator';
import { UserLoader } from '../users/loaders/users.loader';

@Resolver(() => GroupGQL)
export class GroupsResolver {
  constructor(private readonly groupsService: GroupsService) { }

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
  @Mutation(() => GroupGQL, { name: 'leaveOrRemoveMemberFromGroup' })
  async leaveOrRemoveMember(
    @Args('groupId', { type: () => ID }) groupId: string,
    @CurrentUser() currentUser: UserDocument,
    @Args('userIdToRemove', { type: () => ID, nullable: true })
    userIdToRemove?: string,
  ): Promise<GroupDocument> {
    // Logic moved to service
    return this.groupsService.removeMember(
      groupId,
      currentUser._id.toString(),
      userIdToRemove,
    );
  }

  @UseGuards(CombinedAuthGuard)
  @Query(() => [GroupGQL], { name: 'getGroups' })
  async getGroups(@Args() args: GetGroupsArgs): Promise<GroupDocument[]> {
    return this.groupsService.findAll(args);
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
    // Note: This still maps ALL members. Ideally we should paginate this via a sub-resolver,
    // but for now we are fixing the N+1 issue by using the Loader.
    return Promise.all(
      group.members.map(async (member) => {
        const userId =
          typeof member.user === 'string'
            ? member.user
            : (member.user as any)._id.toString();
        const user = await userLoader.load(userId);
        return {
          ...member, // Copy role and joinedAt
          user: user as unknown as User, // Inject loaded user
        };
      }),
    );
  }
}
