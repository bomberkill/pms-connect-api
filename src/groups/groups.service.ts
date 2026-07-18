import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GroupMemberRole, GroupPrivacy } from '../../generated/prisma/enums';
import type { GroupModel } from '../../generated/prisma/models';
import type { Prisma } from '../../generated/prisma/client';
import { CreateGroupInput } from './dto/create-group.input';
import { GetGroupsArgs } from './dto/get-groups.args';
import { UpdateGroupInput } from './dto/update-group.input';
import { UserDocument } from '../users/schemas/users.schema';
import {
  GroupMembershipService,
  PopulatedGroupMembership,
} from './group-membership.service';
import {
  CurrentUserType,
  isAdminUser,
} from '../auth/decorators/current-user.decorator';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipService: GroupMembershipService,
  ) {}

  async create(
    createGroupInput: CreateGroupInput,
    creator: UserDocument,
  ): Promise<GroupModel> {
    const { name, description, privacy } = createGroupInput;

    // 1. Generate a unique slug
    const slug = await this._generateUniqueSlug(name);

    // 2. Create the new group (without members)
    const savedGroup = await this.prisma.group.create({
      data: { name, slug, description, privacy, creatorId: creator.id },
    });

    // 3. Add the creator as the first member with ADMIN role using GroupMembershipService
    await this.membershipService.addMember(
      savedGroup.id,
      creator.id,
      GroupMemberRole.ADMIN,
    );

    return savedGroup;
  }

  private async _generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = slugify(baseName, { lower: true, strict: true });
    let slug = baseSlug;
    let isUnique = false;
    while (!isUnique) {
      const existingGroup = await this.prisma.group.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existingGroup) isUnique = true;
      else slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
    }
    return slug;
  }

  /**
   * Finds a single group by its slug.
   */
  async findBySlug(slug: string): Promise<GroupModel | null> {
    return this.prisma.group.findUnique({ where: { slug } });
  }

  /**
   * Finds a single group by its ID.
   */
  async findGroupById(id: string): Promise<GroupModel | null> {
    return this.prisma.group.findUnique({ where: { id } });
  }

  /**
   * Guards group *content* (members, posts) rather than the group's own
   * metadata: for PRIVATE/SECRET groups, only members and admins may view
   * the member list or post feed. Basic group metadata (name, description,
   * member count) stays visible to any authenticated caller via
   * findBySlug/findGroupById — only content behind this check is gated.
   */
  async assertCanViewGroupContent(
    groupId: string,
    viewer: CurrentUserType | null | undefined,
  ): Promise<GroupModel> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }
    if (group.privacy === GroupPrivacy.PUBLIC || isAdminUser(viewer)) {
      return group;
    }
    if (!viewer || !('id' in viewer)) {
      throw new ForbiddenException(
        'You must be a member of this group to view its content.',
      );
    }
    const isMember = await this.membershipService.isMember(
      groupId,
      viewer.id,
    );
    if (!isMember) {
      throw new ForbiddenException(
        'You must be a member of this group to view its content.',
      );
    }
    return group;
  }

  /**
   * Guards post *creation* inside a group — unlike viewing content, this
   * always requires actual membership regardless of the group's privacy
   * tier (a PUBLIC group can be seen by anyone, but posting still requires
   * having joined it).
   */
  async assertCanPostInGroup(
    groupId: string,
    userId: string,
  ): Promise<GroupModel> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }
    const isMember = await this.membershipService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException(
        'You must be a member of this group to post in it.',
      );
    }
    return group;
  }

  /**
   * Updates a group's details.
   */
  async update(
    groupId: string,
    currentUserId: string,
    updateGroupInput: UpdateGroupInput,
  ): Promise<GroupModel> {
    // 1. Fetch the group first to check permissions
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    // 2. Check if the current user is an admin of the group
    const member = await this.membershipService.getMembership(
      groupId,
      currentUserId,
    );

    if (!member || member.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an admin to update this group.',
      );
    }

    const updatePayload: Prisma.GroupUpdateInput = { ...updateGroupInput };
    // If name is changing, regenerate the slug
    if (updateGroupInput.name) {
      updatePayload.slug = await this._generateUniqueSlug(
        updateGroupInput.name,
      );
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: updatePayload,
    });
  }

  async adminUpdate(
    groupId: string,
    updateGroupInput: UpdateGroupInput,
  ): Promise<GroupModel> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const updatePayload: Prisma.GroupUpdateInput = { ...updateGroupInput };

    if (updateGroupInput.name) {
      updatePayload.slug = await this._generateUniqueSlug(
        updateGroupInput.name,
      );
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: updatePayload,
    });
  }

  /**
   * Adds a member to a group using GroupMembershipService.
   */
  async addMember(
    groupId: string,
    userIdToAdd: string,
  ): Promise<GroupModel> {
    // Verify group exists
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    // Use GroupMembershipService to add member
    await this.membershipService.addMember(
      groupId,
      userIdToAdd,
      GroupMemberRole.MEMBER,
    );

    return group;
  }

  /**
   * Removes a member from a group using GroupMembershipService.
   */
  async removeMember(
    groupId: string,
    currentUserId: string,
    userIdToRemove?: string,
  ): Promise<GroupModel> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const finalUserIdToRemove = userIdToRemove || currentUserId;

    // Check if user to remove is a member
    const memberToRemove = await this.membershipService.getMembership(
      groupId,
      finalUserIdToRemove,
    );
    if (!memberToRemove) {
      throw new NotFoundException('User is not a member of this group.');
    }

    // A user is trying to remove someone else
    if (userIdToRemove && userIdToRemove !== currentUserId) {
      const currentUserMember = await this.membershipService.getMembership(
        groupId,
        currentUserId,
      );

      if (!currentUserMember) {
        throw new ForbiddenException('You are not a member of this group.');
      }

      const roleHierarchy = {
        [GroupMemberRole.ADMIN]: 2,
        [GroupMemberRole.MODERATOR]: 1,
        [GroupMemberRole.MEMBER]: 0,
      };

      const currentUserRoleLevel = roleHierarchy[currentUserMember.role];
      const memberToRemoveRoleLevel = roleHierarchy[memberToRemove.role];

      // A user can only remove someone with a strictly lower role
      if (currentUserRoleLevel <= memberToRemoveRoleLevel) {
        throw new ForbiddenException(
          'You do not have sufficient permissions to remove this member.',
        );
      }

      // Specific rule: Only the creator can remove an admin
      if (
        memberToRemove.role === GroupMemberRole.ADMIN &&
        group.creatorId !== currentUserId
      ) {
        throw new ForbiddenException(
          'Only the group creator can remove an administrator.',
        );
      }
    }
    // A user is trying to leave the group
    else {
      if (group.creatorId === currentUserId) {
        throw new ForbiddenException(
          'The creator cannot leave the group. You must delete it instead.',
        );
      }
    }

    // The creator can never be removed from the group by anyone.
    if (group.creatorId === finalUserIdToRemove) {
      throw new BadRequestException('The group creator cannot be removed.');
    }

    // Use GroupMembershipService to remove member
    await this.membershipService.removeMember(groupId, finalUserIdToRemove);

    return group;
  }

  async updateMemberRole(
    groupId: string,
    currentUserId: string,
    userIdToUpdate: string,
    newRole: GroupMemberRole,
  ): Promise<PopulatedGroupMembership> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    const currentUserMembership = await this.membershipService.getMembership(
      groupId,
      currentUserId,
    );
    if (!currentUserMembership || currentUserMembership.role !== GroupMemberRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an admin to update a member role.',
      );
    }

    if (group.creatorId === userIdToUpdate) {
      throw new BadRequestException(
        'The group creator role cannot be changed.',
      );
    }

    const targetMembership = await this.membershipService.getMembership(
      groupId,
      userIdToUpdate,
    );
    if (!targetMembership) {
      throw new NotFoundException('User is not a member of this group.');
    }

    return this.membershipService.updateMemberRole(
      groupId,
      userIdToUpdate,
      newRole,
    );
  }

  async adminRemoveMember(
    groupId: string,
    userIdToRemove: string,
  ): Promise<GroupModel> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    if (group.creatorId === userIdToRemove) {
      throw new BadRequestException('The group creator cannot be removed.');
    }

    const membership = await this.membershipService.getMembership(
      groupId,
      userIdToRemove,
    );
    if (!membership) {
      throw new NotFoundException('User is not a member of this group.');
    }

    await this.membershipService.removeMember(groupId, userIdToRemove);

    return group;
  }

  async adminUpdateMemberRole(
    groupId: string,
    userIdToUpdate: string,
    newRole: GroupMemberRole,
  ): Promise<PopulatedGroupMembership> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    if (group.creatorId === userIdToUpdate) {
      throw new BadRequestException(
        'The group creator role cannot be changed.',
      );
    }

    const membership = await this.membershipService.getMembership(
      groupId,
      userIdToUpdate,
    );
    if (!membership) {
      throw new NotFoundException('User is not a member of this group.');
    }

    return this.membershipService.updateMemberRole(
      groupId,
      userIdToUpdate,
      newRole,
    );
  }

  async delete(groupId: string, currentUserId: string): Promise<boolean> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    if (group.creatorId !== currentUserId) {
      throw new ForbiddenException('Only the group creator can delete this group.');
    }

    // Membership/join-requests/posts cascade-delete via the Group FK's
    // onDelete: Cascade — a single delete is enough now.
    await this.prisma.group.delete({ where: { id: groupId } });

    return true;
  }

  async adminDelete(groupId: string): Promise<boolean> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found.`);
    }

    await this.prisma.group.delete({ where: { id: groupId } });

    return true;
  }

  /**
   * Finds all groups with pagination and filtering.
   */
  async findAll(
    args: GetGroupsArgs,
    viewer?: CurrentUserType | null,
  ): Promise<GroupModel[]> {
    const { skip, limit, search, privacy } = args;
    const where: Prisma.GroupWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (privacy) {
      where.privacy = privacy;
    }

    // SECRET groups are discoverable only by their members (or an admin) —
    // exclude them from the general listing for everyone else.
    if (!isAdminUser(viewer)) {
      const memberGroupIds =
        viewer && 'id' in viewer
          ? await this.membershipService.getUserGroupIds(viewer.id)
          : [];
      where.OR = [
        { privacy: { not: GroupPrivacy.SECRET } },
        { id: { in: memberGroupIds } },
      ];
    }

    return this.prisma.group.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }
}
